#ifdef DEBUG_ESP_PORT
    #define DEBUG_MSG(...) DEBUG_ESP_PORT.println( __VA_ARGS__ )
    #define DEBUG_WRITE(...) DEBUG_ESP_PORT.write( __VA_ARGS__ )
    #define DEBUG_MSG_(...) DEBUG_ESP_PORT.print( __VA_ARGS__ )
#else
    #define DEBUG_MSG(...)
    #define DEBUG_WRITE(...)
    #define DEBUG_MSG_(...)
#endif


#include <Arduino.h>
#include <ESP8266WiFi.h>

// https://github.com/Links2004/arduinoWebSockets/
#include <WebSocketsClient.h>

// https://arduinojson.org/
#include <ArduinoJson.h>

#include <Hash.h>

// Create yours based on config.h.tmpl
#include "config.h"
#include "certificate.h"

WebSocketsClient webSocket;

void ICACHE_RAM_ATTR toggle();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);

// We have a very simple state. Either our light is on or off
bool state = false;

void setup() {

#ifdef DEBUG_ESP_PORT
    DEBUG_ESP_PORT.begin(115200);
#endif    

    WiFi.begin(WLAN_SSID, WLAN_PASS);

    configTime(0, 0, "pool.ntp.org", "time.nist.gov");

    webSocket.beginSslWithCA("api.iotmaster.dev", 443, "/api/ws?deviceid=" DEVICE_ID "&apikey=" API_KEY, CA_cert);
    webSocket.onEvent(webSocketEvent);

    pinMode(LED_BUILTIN, OUTPUT);
    applyState();

    pinMode(D1, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(D1), toggle, CHANGE);

    
}

void loop() {
    webSocket.loop();
}

void ICACHE_RAM_ATTR toggle() {
  state = !state;
  applyState();
  publishState();
}

void applyState() {
    digitalWrite(LED_BUILTIN, state ? LOW : HIGH);
}

void publishState() {

    const size_t capacity = JSON_OBJECT_SIZE(20);
    DynamicJsonDocument doc(capacity);

    doc["action"] = "update";
    doc["deviceid"] = DEVICE_ID;
    doc["apikey"] = API_KEY;
    JsonObject params  = doc.createNestedObject("params");
    params["on"] = state;

    String json;
    serializeJson(doc, json);  
    
    webSocket.sendTXT(json);

}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {

    switch(type) {

        case WStype_DISCONNECTED:
            DEBUG_MSG("[WSc] Disconnected!\n");
            break;

        case WStype_CONNECTED:
            DEBUG_MSG("[WSc] Connected to url:");
            DEBUG_WRITE(payload, length);
            publishState();     
            break;

        case WStype_TEXT:
            DEBUG_MSG("[WSc] got text:");
            DEBUG_WRITE(payload, length);

            const size_t capacity = JSON_OBJECT_SIZE(20);
            DynamicJsonDocument doc(capacity);

            // Deserialize the JSON document
            DeserializationError error = deserializeJson(doc, payload, length);

            // Test if parsing succeeds.
            if (error) {
                DEBUG_MSG_(F("deserializeJson() failed: "));
                DEBUG_MSG(error.c_str());
                return;
            }

            if (doc["action"] == "update") {
                const char *sequence = doc["sequence"];
                JsonObject params = doc["params"];
                
                if (params.containsKey("on")) {
                  state = params["on"];
                  applyState();
                  sendRecipt(sequence);
                }
                
            }
            
            break;

    }

}

void sendRecipt(const char *sequence) {

    const size_t capacity = JSON_OBJECT_SIZE(20);
    DynamicJsonDocument doc(capacity);

    doc["error"] = 0;
    doc["sequence"] = sequence;

    String json;
    serializeJson(doc, json);  
    
    webSocket.sendTXT(json);
  
}
