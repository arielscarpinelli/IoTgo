angular.module('iotgo')
	.directive('passwordToggle', function ($compile) {
		return {
			restrict: 'A',
			scope: {},
			link: function (scope, elem, attrs) {
				const lnk = angular.element('<span ng-class="{\'fa fa-2x\': true, \'fa-eye\': show, \'fa-eye-slash\': !show}" data-ng-click="tgl()" style="float: right; margin-left: -40px; margin-top: -35px; position: relative; z-index: 2;"></span>');

				scope.tgl = function () {
					scope.show = !scope.show;
					elem.attr('type', (scope.show ? 'password' : 'text'));
				};

				scope.show = true;

				$compile(lnk)(scope);
				elem.after(lnk);
			}
		}
	});