/*
 * Viewport - jQuery selectors for finding elements in viewport
 *
 * Copyright (c) 2008-2009 Mika Tuupola
 *
 * Licensed under the MIT license:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Project home:
 *  http://www.appelsiini.net/projects/viewport
 *
 */

(function(e){e.belowthefold=function(t,n){var r=e(window).height()+e(window).scrollTop();return r<=e(t).offset().top-n.threshold},e.abovethetop=function(t,n){var r=e(window).scrollTop();return r>=e(t).offset().top+e(t).height()-n.threshold},e.rightofscreen=function(t,n){var r=e(window).width()+e(window).scrollLeft();return r<=e(t).offset().left-n.threshold},e.leftofscreen=function(t,n){var r=e(window).scrollLeft();return r>=e(t).offset().left+e(t).width()-n.threshold},e.inviewport=function(t,n){return!e.rightofscreen(t,n)&&!e.leftofscreen(t,n)&&!e.belowthefold(t,n)&&!e.abovethetop(t,n)},e.extend(e.expr[":"],{"below-the-fold":function(t,n,r){return e.belowthefold(t,{threshold:0})},"above-the-top":function(t,n,r){return e.abovethetop(t,{threshold:0})},"left-of-screen":function(t,n,r){return e.leftofscreen(t,{threshold:0})},"right-of-screen":function(t,n,r){return e.rightofscreen(t,{threshold:0})},"in-viewport":function(t,n,r){return e.inviewport(t,{threshold:0})}})})(jQuery);