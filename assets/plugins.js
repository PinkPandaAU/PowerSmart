(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, factory(global.window = global.window || {}));
}(this, (function (exports) { 'use strict';

	var _svgPathExp = /[achlmqstvz]|(-?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/ig,
	    _scientific = /[\+\-]?\d*\.?\d+e[\+\-]?\d+/ig,
	    _DEG2RAD = Math.PI / 180,
	    _sin = Math.sin,
	    _cos = Math.cos,
	    _abs = Math.abs,
	    _sqrt = Math.sqrt,
	    _isNumber = function _isNumber(value) {
	  return typeof value === "number";
	},
	    _roundingNum = 1e5,
	    _round = function _round(value) {
	  return Math.round(value * _roundingNum) / _roundingNum || 0;
	};
	function transformRawPath(rawPath, a, b, c, d, tx, ty) {
	  var j = rawPath.length,
	      segment,
	      l,
	      i,
	      x,
	      y;

	  while (--j > -1) {
	    segment = rawPath[j];
	    l = segment.length;

	    for (i = 0; i < l; i += 2) {
	      x = segment[i];
	      y = segment[i + 1];
	      segment[i] = x * a + y * c + tx;
	      segment[i + 1] = x * b + y * d + ty;
	    }
	  }

	  rawPath._dirty = 1;
	  return rawPath;
	}

	function arcToSegment(lastX, lastY, rx, ry, angle, largeArcFlag, sweepFlag, x, y) {
	  if (lastX === x && lastY === y) {
	    return;
	  }

	  rx = _abs(rx);
	  ry = _abs(ry);

	  var angleRad = angle % 360 * _DEG2RAD,
	      cosAngle = _cos(angleRad),
	      sinAngle = _sin(angleRad),
	      PI = Math.PI,
	      TWOPI = PI * 2,
	      dx2 = (lastX - x) / 2,
	      dy2 = (lastY - y) / 2,
	      x1 = cosAngle * dx2 + sinAngle * dy2,
	      y1 = -sinAngle * dx2 + cosAngle * dy2,
	      x1_sq = x1 * x1,
	      y1_sq = y1 * y1,
	      radiiCheck = x1_sq / (rx * rx) + y1_sq / (ry * ry);

	  if (radiiCheck > 1) {
	    rx = _sqrt(radiiCheck) * rx;
	    ry = _sqrt(radiiCheck) * ry;
	  }

	  var rx_sq = rx * rx,
	      ry_sq = ry * ry,
	      sq = (rx_sq * ry_sq - rx_sq * y1_sq - ry_sq * x1_sq) / (rx_sq * y1_sq + ry_sq * x1_sq);

	  if (sq < 0) {
	    sq = 0;
	  }

	  var coef = (largeArcFlag === sweepFlag ? -1 : 1) * _sqrt(sq),
	      cx1 = coef * (rx * y1 / ry),
	      cy1 = coef * -(ry * x1 / rx),
	      sx2 = (lastX + x) / 2,
	      sy2 = (lastY + y) / 2,
	      cx = sx2 + (cosAngle * cx1 - sinAngle * cy1),
	      cy = sy2 + (sinAngle * cx1 + cosAngle * cy1),
	      ux = (x1 - cx1) / rx,
	      uy = (y1 - cy1) / ry,
	      vx = (-x1 - cx1) / rx,
	      vy = (-y1 - cy1) / ry,
	      temp = ux * ux + uy * uy,
	      angleStart = (uy < 0 ? -1 : 1) * Math.acos(ux / _sqrt(temp)),
	      angleExtent = (ux * vy - uy * vx < 0 ? -1 : 1) * Math.acos((ux * vx + uy * vy) / _sqrt(temp * (vx * vx + vy * vy)));

	  isNaN(angleExtent) && (angleExtent = PI);

	  if (!sweepFlag && angleExtent > 0) {
	    angleExtent -= TWOPI;
	  } else if (sweepFlag && angleExtent < 0) {
	    angleExtent += TWOPI;
	  }

	  angleStart %= TWOPI;
	  angleExtent %= TWOPI;

	  var segments = Math.ceil(_abs(angleExtent) / (TWOPI / 4)),
	      rawPath = [],
	      angleIncrement = angleExtent / segments,
	      controlLength = 4 / 3 * _sin(angleIncrement / 2) / (1 + _cos(angleIncrement / 2)),
	      ma = cosAngle * rx,
	      mb = sinAngle * rx,
	      mc = sinAngle * -ry,
	      md = cosAngle * ry,
	      i;

	  for (i = 0; i < segments; i++) {
	    angle = angleStart + i * angleIncrement;
	    x1 = _cos(angle);
	    y1 = _sin(angle);
	    ux = _cos(angle += angleIncrement);
	    uy = _sin(angle);
	    rawPath.push(x1 - controlLength * y1, y1 + controlLength * x1, ux + controlLength * uy, uy - controlLength * ux, ux, uy);
	  }

	  for (i = 0; i < rawPath.length; i += 2) {
	    x1 = rawPath[i];
	    y1 = rawPath[i + 1];
	    rawPath[i] = x1 * ma + y1 * mc + cx;
	    rawPath[i + 1] = x1 * mb + y1 * md + cy;
	  }

	  rawPath[i - 2] = x;
	  rawPath[i - 1] = y;
	  return rawPath;
	}

	function stringToRawPath(d) {
	  var a = (d + "").replace(_scientific, function (m) {
	    var n = +m;
	    return n < 0.0001 && n > -0.0001 ? 0 : n;
	  }).match(_svgPathExp) || [],
	      path = [],
	      relativeX = 0,
	      relativeY = 0,
	      twoThirds = 2 / 3,
	      elements = a.length,
	      points = 0,
	      errorMessage = "ERROR: malformed path: " + d,
	      i,
	      j,
	      x,
	      y,
	      command,
	      isRelative,
	      segment,
	      startX,
	      startY,
	      difX,
	      difY,
	      beziers,
	      prevCommand,
	      flag1,
	      flag2,
	      line = function line(sx, sy, ex, ey) {
	    difX = (ex - sx) / 3;
	    difY = (ey - sy) / 3;
	    segment.push(sx + difX, sy + difY, ex - difX, ey - difY, ex, ey);
	  };

	  if (!d || !isNaN(a[0]) || isNaN(a[1])) {
	    console.log(errorMessage);
	    return path;
	  }

	  for (i = 0; i < elements; i++) {
	    prevCommand = command;

	    if (isNaN(a[i])) {
	      command = a[i].toUpperCase();
	      isRelative = command !== a[i];
	    } else {
	      i--;
	    }

	    x = +a[i + 1];
	    y = +a[i + 2];

	    if (isRelative) {
	      x += relativeX;
	      y += relativeY;
	    }

	    if (!i) {
	      startX = x;
	      startY = y;
	    }

	    if (command === "M") {
	      if (segment) {
	        if (segment.length < 8) {
	          path.length -= 1;
	        } else {
	          points += segment.length;
	        }
	      }

	      relativeX = startX = x;
	      relativeY = startY = y;
	      segment = [x, y];
	      path.push(segment);
	      i += 2;
	      command = "L";
	    } else if (command === "C") {
	      if (!segment) {
	        segment = [0, 0];
	      }

	      if (!isRelative) {
	        relativeX = relativeY = 0;
	      }

	      segment.push(x, y, relativeX + a[i + 3] * 1, relativeY + a[i + 4] * 1, relativeX += a[i + 5] * 1, relativeY += a[i + 6] * 1);
	      i += 6;
	    } else if (command === "S") {
	      difX = relativeX;
	      difY = relativeY;

	      if (prevCommand === "C" || prevCommand === "S") {
	        difX += relativeX - segment[segment.length - 4];
	        difY += relativeY - segment[segment.length - 3];
	      }

	      if (!isRelative) {
	        relativeX = relativeY = 0;
	      }

	      segment.push(difX, difY, x, y, relativeX += a[i + 3] * 1, relativeY += a[i + 4] * 1);
	      i += 4;
	    } else if (command === "Q") {
	      difX = relativeX + (x - relativeX) * twoThirds;
	      difY = relativeY + (y - relativeY) * twoThirds;

	      if (!isRelative) {
	        relativeX = relativeY = 0;
	      }

	      relativeX += a[i + 3] * 1;
	      relativeY += a[i + 4] * 1;
	      segment.push(difX, difY, relativeX + (x - relativeX) * twoThirds, relativeY + (y - relativeY) * twoThirds, relativeX, relativeY);
	      i += 4;
	    } else if (command === "T") {
	      difX = relativeX - segment[segment.length - 4];
	      difY = relativeY - segment[segment.length - 3];
	      segment.push(relativeX + difX, relativeY + difY, x + (relativeX + difX * 1.5 - x) * twoThirds, y + (relativeY + difY * 1.5 - y) * twoThirds, relativeX = x, relativeY = y);
	      i += 2;
	    } else if (command === "H") {
	      line(relativeX, relativeY, relativeX = x, relativeY);
	      i += 1;
	    } else if (command === "V") {
	      line(relativeX, relativeY, relativeX, relativeY = x + (isRelative ? relativeY - relativeX : 0));
	      i += 1;
	    } else if (command === "L" || command === "Z") {
	      if (command === "Z") {
	        x = startX;
	        y = startY;
	        segment.closed = true;
	      }

	      if (command === "L" || _abs(relativeX - x) > 0.5 || _abs(relativeY - y) > 0.5) {
	        line(relativeX, relativeY, x, y);

	        if (command === "L") {
	          i += 2;
	        }
	      }

	      relativeX = x;
	      relativeY = y;
	    } else if (command === "A") {
	      flag1 = a[i + 4];
	      flag2 = a[i + 5];
	      difX = a[i + 6];
	      difY = a[i + 7];
	      j = 7;

	      if (flag1.length > 1) {
	        if (flag1.length < 3) {
	          difY = difX;
	          difX = flag2;
	          j--;
	        } else {
	          difY = flag2;
	          difX = flag1.substr(2);
	          j -= 2;
	        }

	        flag2 = flag1.charAt(1);
	        flag1 = flag1.charAt(0);
	      }

	      beziers = arcToSegment(relativeX, relativeY, +a[i + 1], +a[i + 2], +a[i + 3], +flag1, +flag2, (isRelative ? relativeX : 0) + difX * 1, (isRelative ? relativeY : 0) + difY * 1);
	      i += j;

	      if (beziers) {
	        for (j = 0; j < beziers.length; j++) {
	          segment.push(beziers[j]);
	        }
	      }

	      relativeX = segment[segment.length - 2];
	      relativeY = segment[segment.length - 1];
	    } else {
	      console.log(errorMessage);
	    }
	  }

	  i = segment.length;

	  if (i < 6) {
	    path.pop();
	    i = 0;
	  } else if (segment[0] === segment[i - 2] && segment[1] === segment[i - 1]) {
	    segment.closed = true;
	  }

	  path.totalPoints = points + i;
	  return path;
	}
	function rawPathToString(rawPath) {
	  if (_isNumber(rawPath[0])) {
	    rawPath = [rawPath];
	  }

	  var result = "",
	      l = rawPath.length,
	      sl,
	      s,
	      i,
	      segment;

	  for (s = 0; s < l; s++) {
	    segment = rawPath[s];
	    result += "M" + _round(segment[0]) + "," + _round(segment[1]) + " C";
	    sl = segment.length;

	    for (i = 2; i < sl; i++) {
	      result += _round(segment[i++]) + "," + _round(segment[i++]) + " " + _round(segment[i++]) + "," + _round(segment[i++]) + " " + _round(segment[i++]) + "," + _round(segment[i]) + " ";
	    }

	    if (segment.closed) {
	      result += "z";
	    }
	  }

	  return result;
	}

	/*!
	 * CustomEase 3.11.3
	 * https://greensock.com
	 *
	 * @license Copyright 2008-2022, GreenSock. All rights reserved.
	 * Subject to the terms at https://greensock.com/standard-license or for
	 * Club GreenSock members, the agreement issued with that membership.
	 * @author: Jack Doyle, jack@greensock.com
	*/

	var gsap,
	    _coreInitted,
	    _getGSAP = function _getGSAP() {
	  return gsap || typeof window !== "undefined" && (gsap = window.gsap) && gsap.registerPlugin && gsap;
	},
	    _initCore = function _initCore() {
	  gsap = _getGSAP();

	  if (gsap) {
	    gsap.registerEase("_CE", CustomEase.create);
	    _coreInitted = 1;
	  } else {
	    console.warn("Please gsap.registerPlugin(CustomEase)");
	  }
	},
	    _bigNum = 1e20,
	    _round$1 = function _round(value) {
	  return ~~(value * 1000 + (value < 0 ? -.5 : .5)) / 1000;
	},
	    _numExp = /[-+=\.]*\d+[\.e\-\+]*\d*[e\-\+]*\d*/gi,
	    _needsParsingExp = /[cLlsSaAhHvVtTqQ]/g,
	    _findMinimum = function _findMinimum(values) {
	  var l = values.length,
	      min = _bigNum,
	      i;

	  for (i = 1; i < l; i += 6) {
	    +values[i] < min && (min = +values[i]);
	  }

	  return min;
	},
	    _normalize = function _normalize(values, height, originY) {
	  if (!originY && originY !== 0) {
	    originY = Math.max(+values[values.length - 1], +values[1]);
	  }

	  var tx = +values[0] * -1,
	      ty = -originY,
	      l = values.length,
	      sx = 1 / (+values[l - 2] + tx),
	      sy = -height || (Math.abs(+values[l - 1] - +values[1]) < 0.01 * (+values[l - 2] - +values[0]) ? _findMinimum(values) + ty : +values[l - 1] + ty),
	      i;

	  if (sy) {
	    sy = 1 / sy;
	  } else {
	    sy = -sx;
	  }

	  for (i = 0; i < l; i += 2) {
	    values[i] = (+values[i] + tx) * sx;
	    values[i + 1] = (+values[i + 1] + ty) * sy;
	  }
	},
	    _bezierToPoints = function _bezierToPoints(x1, y1, x2, y2, x3, y3, x4, y4, threshold, points, index) {
	  var x12 = (x1 + x2) / 2,
	      y12 = (y1 + y2) / 2,
	      x23 = (x2 + x3) / 2,
	      y23 = (y2 + y3) / 2,
	      x34 = (x3 + x4) / 2,
	      y34 = (y3 + y4) / 2,
	      x123 = (x12 + x23) / 2,
	      y123 = (y12 + y23) / 2,
	      x234 = (x23 + x34) / 2,
	      y234 = (y23 + y34) / 2,
	      x1234 = (x123 + x234) / 2,
	      y1234 = (y123 + y234) / 2,
	      dx = x4 - x1,
	      dy = y4 - y1,
	      d2 = Math.abs((x2 - x4) * dy - (y2 - y4) * dx),
	      d3 = Math.abs((x3 - x4) * dy - (y3 - y4) * dx),
	      length;

	  if (!points) {
	    points = [{
	      x: x1,
	      y: y1
	    }, {
	      x: x4,
	      y: y4
	    }];
	    index = 1;
	  }

	  points.splice(index || points.length - 1, 0, {
	    x: x1234,
	    y: y1234
	  });

	  if ((d2 + d3) * (d2 + d3) > threshold * (dx * dx + dy * dy)) {
	    length = points.length;

	    _bezierToPoints(x1, y1, x12, y12, x123, y123, x1234, y1234, threshold, points, index);

	    _bezierToPoints(x1234, y1234, x234, y234, x34, y34, x4, y4, threshold, points, index + 1 + (points.length - length));
	  }

	  return points;
	};

	var CustomEase = function () {
	  function CustomEase(id, data, config) {
	    _coreInitted || _initCore();
	    this.id = id;
	     this.setData(data, config);
	  }

	  var _proto = CustomEase.prototype;

	  _proto.setData = function setData(data, config) {
	    config = config || {};
	    data = data || "0,0,1,1";
	    var values = data.match(_numExp),
	        closest = 1,
	        points = [],
	        lookup = [],
	        precision = config.precision || 1,
	        fast = precision <= 1,
	        l,
	        a1,
	        a2,
	        i,
	        inc,
	        j,
	        point,
	        prevPoint,
	        p;
	    this.data = data;

	    if (_needsParsingExp.test(data) || ~data.indexOf("M") && data.indexOf("C") < 0) {
	      values = stringToRawPath(data)[0];
	    }

	    l = values.length;

	    if (l === 4) {
	      values.unshift(0, 0);
	      values.push(1, 1);
	      l = 8;
	    } else if ((l - 2) % 6) {
	      throw "Invalid CustomEase";
	    }

	    if (+values[0] !== 0 || +values[l - 2] !== 1) {
	      _normalize(values, config.height, config.originY);
	    }

	    this.segment = values;

	    for (i = 2; i < l; i += 6) {
	      a1 = {
	        x: +values[i - 2],
	        y: +values[i - 1]
	      };
	      a2 = {
	        x: +values[i + 4],
	        y: +values[i + 5]
	      };
	      points.push(a1, a2);

	      _bezierToPoints(a1.x, a1.y, +values[i], +values[i + 1], +values[i + 2], +values[i + 3], a2.x, a2.y, 1 / (precision * 200000), points, points.length - 1);
	    }

	    l = points.length;

	    for (i = 0; i < l; i++) {
	      point = points[i];
	      prevPoint = points[i - 1] || point;

	      if ((point.x > prevPoint.x || prevPoint.y !== point.y && prevPoint.x === point.x || point === prevPoint) && point.x <= 1) {
	        prevPoint.cx = point.x - prevPoint.x;
	        prevPoint.cy = point.y - prevPoint.y;
	        prevPoint.n = point;
	        prevPoint.nx = point.x;

	        if (fast && i > 1 && Math.abs(prevPoint.cy / prevPoint.cx - points[i - 2].cy / points[i - 2].cx) > 2) {
	          fast = 0;
	        }

	        if (prevPoint.cx < closest) {
	          if (!prevPoint.cx) {
	            prevPoint.cx = 0.001;

	            if (i === l - 1) {
	              prevPoint.x -= 0.001;
	              closest = Math.min(closest, 0.001);
	              fast = 0;
	            }
	          } else {
	            closest = prevPoint.cx;
	          }
	        }
	      } else {
	        points.splice(i--, 1);
	        l--;
	      }
	    }

	    l = 1 / closest + 1 | 0;
	    inc = 1 / l;
	    j = 0;
	    point = points[0];

	    if (fast) {
	      for (i = 0; i < l; i++) {
	        p = i * inc;

	        if (point.nx < p) {
	          point = points[++j];
	        }

	        a1 = point.y + (p - point.x) / point.cx * point.cy;
	        lookup[i] = {
	          x: p,
	          cx: inc,
	          y: a1,
	          cy: 0,
	          nx: 9
	        };

	        if (i) {
	          lookup[i - 1].cy = a1 - lookup[i - 1].y;
	        }
	      }

	      lookup[l - 1].cy = points[points.length - 1].y - a1;
	    } else {
	      for (i = 0; i < l; i++) {
	        if (point.nx < i * inc) {
	          point = points[++j];
	        }

	        lookup[i] = point;
	      }

	      if (j < points.length - 1) {
	        lookup[i - 1] = points[points.length - 2];
	      }
	    }

	    this.ease = function (p) {
	      var point = lookup[p * l | 0] || lookup[l - 1];

	      if (point.nx < p) {
	        point = point.n;
	      }

	      return point.y + (p - point.x) / point.cx * point.cy;
	    };

	    this.ease.custom = this;
	    this.id && gsap && gsap.registerEase(this.id, this.ease);
	    return this;
	  };

	  _proto.getSVGData = function getSVGData(config) {
	    return CustomEase.getSVGData(this, config);
	  };

	  CustomEase.create = function create(id, data, config) {
	    return new CustomEase(id, data, config).ease;
	  };

	  CustomEase.register = function register(core) {
	    gsap = core;

	    _initCore();
	  };

	  CustomEase.get = function get(id) {
	    return gsap.parseEase(id);
	  };

	  CustomEase.getSVGData = function getSVGData(ease, config) {
	    config = config || {};
	    var width = config.width || 100,
	        height = config.height || 100,
	        x = config.x || 0,
	        y = (config.y || 0) + height,
	        e = gsap.utils.toArray(config.path)[0],
	        a,
	        slope,
	        i,
	        inc,
	        tx,
	        ty,
	        precision,
	        threshold,
	        prevX,
	        prevY;

	    if (config.invert) {
	      height = -height;
	      y = 0;
	    }

	    if (typeof ease === "string") {
	      ease = gsap.parseEase(ease);
	    }

	    if (ease.custom) {
	      ease = ease.custom;
	    }

	    if (ease instanceof CustomEase) {
	      a = rawPathToString(transformRawPath([ease.segment], width, 0, 0, -height, x, y));
	    } else {
	      a = [x, y];
	      precision = Math.max(5, (config.precision || 1) * 200);
	      inc = 1 / precision;
	      precision += 2;
	      threshold = 5 / precision;
	      prevX = _round$1(x + inc * width);
	      prevY = _round$1(y + ease(inc) * -height);
	      slope = (prevY - y) / (prevX - x);

	      for (i = 2; i < precision; i++) {
	        tx = _round$1(x + i * inc * width);
	        ty = _round$1(y + ease(i * inc) * -height);

	        if (Math.abs((ty - prevY) / (tx - prevX) - slope) > threshold || i === precision - 1) {
	          a.push(prevX, prevY);
	          slope = (ty - prevY) / (tx - prevX);
	        }

	        prevX = tx;
	        prevY = ty;
	      }

	      a = "M" + a.join(",");
	    }

	    e && e.setAttribute("d", a);
	    return a;
	  };

	  return CustomEase;
	}();
	_getGSAP() && gsap.registerPlugin(CustomEase);
	CustomEase.version = "3.11.3";

	exports.CustomEase = CustomEase;
	exports.default = CustomEase;

	Object.defineProperty(exports, '__esModule', { value: true });

})));

/*!
 * Observer 3.12.2
 * https://greensock.com
 *
 * @license Copyright 2023, GreenSock. All rights reserved.
 * Subject to the terms at https://greensock.com/standard-license or for Club GreenSock members, the agreement issued with that membership.
 * @author: Jack Doyle, jack@greensock.com
 */

!(function (e, t) {
  "object" == typeof exports && "undefined" != typeof module ? t(exports)
  : "function" == typeof define && define.amd ? define(["exports"], t)
  : t(((e = e || self).window = e.window || {}));
})(this, function (a) {
  "use strict";
  function _defineProperties(e, t) {
    for (var n = 0; n < t.length; n++) {
      var r = t[n];
      ((r.enumerable = r.enumerable || !1), (r.configurable = !0), "value" in r && (r.writable = !0), Object.defineProperty(e, r.key, r));
    }
  }
  function r() {
    return we || ("undefined" != typeof window && (we = window.gsap) && we.registerPlugin && we);
  }
  var we,
    Me,
    Pe,
    Ae,
    De,
    Ee,
    Oe,
    Ye,
    ze,
    t,
    Xe,
    Te,
    ke,
    o = 1,
    Ce = [];
  ((a._scrollers = []), (a._proxies = []));
  function x(e, t) {
    return ~a._proxies.indexOf(e) && a._proxies[a._proxies.indexOf(e) + 1][t];
  }
  function y(e) {
    return !!~t.indexOf(e);
  }
  function z(e, t, n, r, o) {
    return e.addEventListener(t, n, { passive: !r, capture: !!o });
  }
  function A(e, t, n, r) {
    return e.removeEventListener(t, n, !!r);
  }
  function D() {
    return (Xe && Xe.isPressed) || a._scrollers.cache++;
  }
  function E(n, r) {
    function qa(e) {
      if (e || 0 === e) {
        o && (Pe.history.scrollRestoration = "manual");
        var t = Xe && Xe.isPressed;
        ((e = qa.v = Math.round(e) || (Xe && Xe.iOS ? 1 : 0)), n(e), (qa.cacheID = a._scrollers.cache), t && i("ss", e));
      } else (r || a._scrollers.cache !== qa.cacheID || i("ref")) && ((qa.cacheID = a._scrollers.cache), (qa.v = n()));
      return qa.v + qa.offset;
    }
    return ((qa.offset = 0), n && qa);
  }
  function H(e, t) {
    return ((t && t._ctx && t._ctx.selector) || we.utils.toArray)(e)[0] || ("string" == typeof e && !1 !== we.config().nullTargetWarn ? console.warn("Element not found:", e) : null);
  }
  function I(t, e) {
    var n = e.s,
      r = e.sc;
    y(t) && (t = Ae.scrollingElement || De);
    var o = a._scrollers.indexOf(t),
      i = r === He.sc ? 1 : 2;
    (~o || (o = a._scrollers.push(t) - 1), a._scrollers[o + i] || z(t, "scroll", D));
    var c = a._scrollers[o + i],
      s =
        c ||
        (a._scrollers[o + i] =
          E(x(t, n), !0) ||
          (y(t) ? r : (
            E(function (e) {
              return arguments.length ? (t[n] = e) : t[n];
            })
          )));
    return ((s.target = t), c || (s.smooth = "smooth" === we.getProperty(t, "scrollBehavior")), s);
  }
  function J(e, t, o) {
    function Pa(e, t) {
      var n = qe();
      t || r < n - s ? ((c = i), (i = e), (a = s), (s = n))
      : o ? (i += e)
      : (i = c + ((e - c) / (n - a)) * (s - a));
    }
    var i = e,
      c = e,
      s = qe(),
      a = s,
      r = t || 50,
      l = Math.max(500, 3 * r);
    return {
      update: Pa,
      reset: function reset() {
        ((c = i = o ? 0 : i), (a = s = 0));
      },
      getVelocity: function getVelocity(e) {
        var t = a,
          n = c,
          r = qe();
        return ((!e && 0 !== e) || e === i || Pa(e), s === a || l < r - a ? 0 : ((i + (o ? n : -n)) / ((o ? r : s) - t)) * 1e3);
      },
    };
  }
  function K(e, t) {
    return (t && !e._gsapAllow && e.preventDefault(), e.changedTouches ? e.changedTouches[0] : e);
  }
  function L(e) {
    var t = Math.max.apply(Math, e),
      n = Math.min.apply(Math, e);
    return Math.abs(t) >= Math.abs(n) ? t : n;
  }
  function M() {
    (ze = we.core.globals().ScrollTrigger) &&
      ze.core &&
      (function _integrate() {
        var e = ze.core,
          n = e.bridge || {},
          t = e._scrollers,
          r = e._proxies;
        (t.push.apply(t, a._scrollers),
          r.push.apply(r, a._proxies),
          (a._scrollers = t),
          (a._proxies = r),
          (i = function _bridge(e, t) {
            return n[e](t);
          }));
      })();
  }
  function N(e) {
    return (
      (we = e || r()) &&
        "undefined" != typeof document &&
        document.body &&
        ((Pe = window),
        (De = (Ae = document).documentElement),
        (Ee = Ae.body),
        (t = [Pe, Ae, De, Ee]),
        we.utils.clamp,
        (ke = we.core.context || function () {}),
        (Ye = "onpointerenter" in Ee ? "pointer" : "mouse"),
        (Oe = s.isTouch =
          Pe.matchMedia && Pe.matchMedia("(hover: none), (pointer: coarse)").matches ? 1
            : "ontouchstart" in Pe || 0 < navigator.maxTouchPoints || 0 < navigator.msMaxTouchPoints ? 2
            : 0),
        (Te = s.eventTypes =
          (
            "ontouchstart" in De ? "touchstart,touchmove,touchcancel,touchend"
            : "onpointerdown" in De ? "pointerdown,pointermove,pointercancel,pointerup"
            : "mousedown,mousemove,mouseup,mouseup").split(",")),
        setTimeout(function () {
          return (o = 0);
        }, 500),
        M(),
        (Me = 1)),
      Me
    );
  }
  var qe = Date.now,
    i = function _bridge(e, t) {
      return t;
    },
    n = "scrollLeft",
    c = "scrollTop",
    Se = {
      s: n,
      p: "left",
      p2: "Left",
      os: "right",
      os2: "Right",
      d: "width",
      d2: "Width",
      a: "x",
      sc: E(function (e) {
        return arguments.length ? Pe.scrollTo(e, He.sc()) : Pe.pageXOffset || Ae[n] || De[n] || Ee[n] || 0;
      }),
    },
    He = {
      s: c,
      p: "top",
      p2: "Top",
      os: "bottom",
      os2: "Bottom",
      d: "height",
      d2: "Height",
      a: "y",
      op: Se,
      sc: E(function (e) {
        return arguments.length ? Pe.scrollTo(Se.sc(), e) : Pe.pageYOffset || Ae[c] || De[c] || Ee[c] || 0;
      }),
    };
  ((Se.op = He), (a._scrollers.cache = 0));
  var s =
    ((Observer.prototype.init = function init(e) {
      (Me || N(we) || console.warn("Please gsap.registerPlugin(Observer)"), ze || M());
      var o = e.tolerance,
        c = e.dragMinimum,
        t = e.type,
        i = e.target,
        n = e.lineHeight,
        r = e.debounce,
        s = e.preventDefault,
        a = e.onStop,
        l = e.onStopDelay,
        u = e.ignore,
        f = e.wheelSpeed,
        d = e.event,
        g = e.onDragStart,
        p = e.onDragEnd,
        h = e.onDrag,
        v = e.onPress,
        x = e.onRelease,
        _ = e.onRight,
        m = e.onLeft,
        b = e.onUp,
        w = e.onDown,
        P = e.onChangeX,
        E = e.onChangeY,
        O = e.onChange,
        Y = e.onToggleX,
        X = e.onToggleY,
        T = e.onHover,
        k = e.onHoverEnd,
        C = e.onMove,
        q = e.ignoreCheck,
        S = e.isNormalizer,
        B = e.onGestureStart,
        G = e.onGestureEnd,
        V = e.onWheel,
        F = e.onEnable,
        R = e.onDisable,
        j = e.onClick,
        W = e.scrollSpeed,
        U = e.capture,
        Q = e.allowClicks,
        Z = e.lockAxis,
        $ = e.onLockAxis;
      function oc() {
        return (_e = qe());
      }
      function pc(e, t) {
        return ((se.event = e) && u && ~u.indexOf(e.target)) || (t && pe && "touch" !== e.pointerType) || (q && q(e, t));
      }
      function rc() {
        var e = (se.deltaX = L(ye)),
          t = (se.deltaY = L(xe)),
          n = Math.abs(e) >= o,
          r = Math.abs(t) >= o;
        (O && (n || r) && O(se, e, t, ye, xe), n && (_ && 0 < se.deltaX && _(se), m && se.deltaX < 0 && m(se), P && P(se), Y && se.deltaX < 0 != ae < 0 && Y(se), (ae = se.deltaX), (ye[0] = ye[1] = ye[2] = 0)), r && (w && 0 < se.deltaY && w(se), b && se.deltaY < 0 && b(se), E && E(se), X && se.deltaY < 0 != le < 0 && X(se), (le = se.deltaY), (xe[0] = xe[1] = xe[2] = 0)), (re || ne) && (C && C(se), ne && (h(se), (ne = !1)), (re = !1)), ie && !(ie = !1) && $ && $(se), oe && (V(se), (oe = !1)), (ee = 0));
      }
      function sc(e, t, n) {
        ((ye[n] += e), (xe[n] += t), se._vx.update(e), se._vy.update(t), r ? (ee = ee || requestAnimationFrame(rc)) : rc());
      }
      function tc(e, t) {
        (Z && !ce && ((se.axis = ce = Math.abs(e) > Math.abs(t) ? "x" : "y"), (ie = !0)), "y" !== ce && ((ye[2] += e), se._vx.update(e, !0)), "x" !== ce && ((xe[2] += t), se._vy.update(t, !0)), r ? (ee = ee || requestAnimationFrame(rc)) : rc());
      }
      function uc(e) {
        if (!pc(e, 1)) {
          var t = (e = K(e, s)).clientX,
            n = e.clientY,
            r = t - se.x,
            o = n - se.y,
            i = se.isDragging;
          ((se.x = t), (se.y = n), (i || Math.abs(se.startX - t) >= c || Math.abs(se.startY - n) >= c) && (h && (ne = !0), i || (se.isDragging = !0), tc(r, o), i || (g && g(se))));
        }
      }
      function xc(e) {
        return e.touches && 1 < e.touches.length && (se.isGesturing = !0) && B(e, se.isDragging);
      }
      function yc() {
        return (se.isGesturing = !1) || G(se);
      }
      function zc(e) {
        if (!pc(e)) {
          var t = ue(),
            n = fe();
          (sc((t - de) * W, (n - ge) * W, 1), (de = t), (ge = n), a && te.restart(!0));
        }
      }
      function Ac(e) {
        if (!pc(e)) {
          ((e = K(e, s)), V && (oe = !0));
          var t =
            (1 === e.deltaMode ? n
            : 2 === e.deltaMode ? Pe.innerHeight
            : 1) * f;
          (sc(e.deltaX * t, e.deltaY * t, 0), a && !S && te.restart(!0));
        }
      }
      function Bc(e) {
        if (!pc(e)) {
          var t = e.clientX,
            n = e.clientY,
            r = t - se.x,
            o = n - se.y;
          ((se.x = t), (se.y = n), (re = !0), (r || o) && tc(r, o));
        }
      }
      function Cc(e) {
        ((se.event = e), T(se));
      }
      function Dc(e) {
        ((se.event = e), k(se));
      }
      function Ec(e) {
        return pc(e) || (K(e, s) && j(se));
      }
      ((this.target = i = H(i) || De), (this.vars = e), (u = u && we.utils.toArray(u)), (o = o || 1e-9), (c = c || 0), (f = f || 1), (W = W || 1), (t = t || "wheel,touch,pointer"), (r = !1 !== r), (n = n || parseFloat(Pe.getComputedStyle(Ee).lineHeight) || 22));
      var ee,
        te,
        ne,
        re,
        oe,
        ie,
        ce,
        se = this,
        ae = 0,
        le = 0,
        ue = I(i, Se),
        fe = I(i, He),
        de = ue(),
        ge = fe(),
        pe = ~t.indexOf("touch") && !~t.indexOf("pointer") && "pointerdown" === Te[0],
        he = y(i),
        ve = i.ownerDocument || Ae,
        ye = [0, 0, 0],
        xe = [0, 0, 0],
        _e = 0,
        me = (se.onPress = function (e) {
          pc(e, 1) || (e && e.button) || ((se.axis = ce = null), te.pause(), (se.isPressed = !0), (e = K(e)), (ae = le = 0), (se.startX = se.x = e.clientX), (se.startY = se.y = e.clientY), se._vx.reset(), se._vy.reset(), z(S ? i : ve, Te[1], uc, s, !0), (se.deltaX = se.deltaY = 0), v && v(se));
        }),
        be = (se.onRelease = function (t) {
          if (!pc(t, 1)) {
            A(S ? i : ve, Te[1], uc, !0);
            var e = !isNaN(se.y - se.startY),
              n = se.isDragging && (3 < Math.abs(se.x - se.startX) || 3 < Math.abs(se.y - se.startY)),
              r = K(t);
            (!n &&
              e &&
              (se._vx.reset(),
              se._vy.reset(),
              s &&
                Q &&
                we.delayedCall(0.08, function () {
                  if (300 < qe() - _e && !t.defaultPrevented)
                    if (t.target.click) t.target.click();
                    else if (ve.createEvent) {
                      var e = ve.createEvent("MouseEvents");
                      (e.initMouseEvent("click", !0, !0, Pe, 1, r.screenX, r.screenY, r.clientX, r.clientY, !1, !1, !1, !1, 0, null), t.target.dispatchEvent(e));
                    }
                })),
              (se.isDragging = se.isGesturing = se.isPressed = !1),
              a && !S && te.restart(!0),
              p && n && p(se),
              x && x(se, n));
          }
        });
      ((te = se._dc =
        we
          .delayedCall(l || 0.25, function onStopFunc() {
            (se._vx.reset(), se._vy.reset(), te.pause(), a && a(se));
          })
          .pause()),
        (se.deltaX = se.deltaY = 0),
        (se._vx = J(0, 50, !0)),
        (se._vy = J(0, 50, !0)),
        (se.scrollX = ue),
        (se.scrollY = fe),
        (se.isDragging = se.isGesturing = se.isPressed = !1),
        ke(this),
        (se.enable = function (e) {
          return (se.isEnabled || (z(he ? ve : i, "scroll", D), 0 <= t.indexOf("scroll") && z(he ? ve : i, "scroll", zc, s, U), 0 <= t.indexOf("wheel") && z(i, "wheel", Ac, s, U), ((0 <= t.indexOf("touch") && Oe) || 0 <= t.indexOf("pointer")) && (z(i, Te[0], me, s, U), z(ve, Te[2], be), z(ve, Te[3], be), Q && z(i, "click", oc, !1, !0), j && z(i, "click", Ec), B && z(ve, "gesturestart", xc), G && z(ve, "gestureend", yc), T && z(i, Ye + "enter", Cc), k && z(i, Ye + "leave", Dc), C && z(i, Ye + "move", Bc)), (se.isEnabled = !0), e && e.type && me(e), F && F(se)), se);
        }),
        (se.disable = function () {
          se.isEnabled &&
            (Ce.filter(function (e) {
              return e !== se && y(e.target);
            }).length || A(he ? ve : i, "scroll", D),
            se.isPressed && (se._vx.reset(), se._vy.reset(), A(S ? i : ve, Te[1], uc, !0)),
            A(he ? ve : i, "scroll", zc, U),
            A(i, "wheel", Ac, U),
            A(i, Te[0], me, U),
            A(ve, Te[2], be),
            A(ve, Te[3], be),
            A(i, "click", oc, !0),
            A(i, "click", Ec),
            A(ve, "gesturestart", xc),
            A(ve, "gestureend", yc),
            A(i, Ye + "enter", Cc),
            A(i, Ye + "leave", Dc),
            A(i, Ye + "move", Bc),
            (se.isEnabled = se.isPressed = se.isDragging = !1),
            R && R(se));
        }),
        (se.kill = se.revert =
          function () {
            se.disable();
            var e = Ce.indexOf(se);
            (0 <= e && Ce.splice(e, 1), Xe === se && (Xe = 0));
          }),
        Ce.push(se),
        S && y(i) && (Xe = se),
        se.enable(d));
    }),
    (function _createClass(e, t, n) {
      return (t && _defineProperties(e.prototype, t), n && _defineProperties(e, n), e);
    })(Observer, [
      {
        key: "velocityX",
        get: function get() {
          return this._vx.getVelocity();
        },
      },
      {
        key: "velocityY",
        get: function get() {
          return this._vy.getVelocity();
        },
      },
    ]),
    Observer);
  function Observer(e) {
    this.init(e);
  }
  ((s.version = "3.12.2"),
    (s.create = function (e) {
      return new s(e);
    }),
    (s.register = N),
    (s.getAll = function () {
      return Ce.slice();
    }),
    (s.getById = function (t) {
      return Ce.filter(function (e) {
        return e.vars.id === t;
      })[0];
    }),
    r() && we.registerPlugin(s),
    (a.Observer = s),
    (a._getProxyProp = x),
    (a._getScrollFunc = I),
    (a._getTarget = H),
    (a._getVelocityProp = J),
    (a._horizontal = Se),
    (a._isViewport = y),
    (a._vertical = He),
    (a.default = s));
  if (typeof window === "undefined" || window !== a) {
    Object.defineProperty(a, "__esModule", { value: !0 });
  } else {
    delete a.default;
  }
});

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.window = global.window || {}));
}(this, (function (exports) { 'use strict';

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  /*!
   * Observer 3.11.3
   * https://greensock.com
   *
   * @license Copyright 2008-2022, GreenSock. All rights reserved.
   * Subject to the terms at https://greensock.com/standard-license or for
   * Club GreenSock members, the agreement issued with that membership.
   * @author: Jack Doyle, jack@greensock.com
  */
  var gsap,
      _coreInitted,
      _clamp,
      _win,
      _doc,
      _docEl,
      _body,
      _isTouch,
      _pointerType,
      ScrollTrigger,
      _root,
      _normalizer,
      _eventTypes,
      _getGSAP = function _getGSAP() {
    return gsap || typeof window !== "undefined" && (gsap = window.gsap) && gsap.registerPlugin && gsap;
  },
      _startup = 1,
      _observers = [],
      _scrollers = [],
      _proxies = [],
      _getTime = Date.now,
      _bridge = function _bridge(name, value) {
    return value;
  },
      _integrate = function _integrate() {
    var core = ScrollTrigger.core,
        data = core.bridge || {},
        scrollers = core._scrollers,
        proxies = core._proxies;
    scrollers.push.apply(scrollers, _scrollers);
    proxies.push.apply(proxies, _proxies);
    _scrollers = scrollers;
    _proxies = proxies;

    _bridge = function _bridge(name, value) {
      return data[name](value);
    };
  },
      _getProxyProp = function _getProxyProp(element, property) {
    return ~_proxies.indexOf(element) && _proxies[_proxies.indexOf(element) + 1][property];
  },
      _isViewport = function _isViewport(el) {
    return !!~_root.indexOf(el);
  },
      _addListener = function _addListener(element, type, func, nonPassive, capture) {
    return element.addEventListener(type, func, {
      passive: !nonPassive,
      capture: !!capture
    });
  },
      _removeListener = function _removeListener(element, type, func, capture) {
    return element.removeEventListener(type, func, !!capture);
  },
      _scrollLeft = "scrollLeft",
      _scrollTop = "scrollTop",
      _onScroll = function _onScroll() {
    return _normalizer && _normalizer.isPressed || _scrollers.cache++;
  },
      _scrollCacheFunc = function _scrollCacheFunc(f, doNotCache) {
    var cachingFunc = function cachingFunc(value) {
      if (value || value === 0) {
        _startup && (_win.history.scrollRestoration = "manual");
        var isNormalizing = _normalizer && _normalizer.isPressed;
        value = cachingFunc.v = Math.round(value) || (_normalizer && _normalizer.iOS ? 1 : 0);
        f(value);
        cachingFunc.cacheID = _scrollers.cache;
        isNormalizing && _bridge("ss", value);
      } else if (doNotCache || _scrollers.cache !== cachingFunc.cacheID || _bridge("ref")) {
        cachingFunc.cacheID = _scrollers.cache;
        cachingFunc.v = f();
      }

      return cachingFunc.v + cachingFunc.offset;
    };

    cachingFunc.offset = 0;
    return f && cachingFunc;
  },
      _horizontal = {
    s: _scrollLeft,
    p: "left",
    p2: "Left",
    os: "right",
    os2: "Right",
    d: "width",
    d2: "Width",
    a: "x",
    sc: _scrollCacheFunc(function (value) {
      return arguments.length ? _win.scrollTo(value, _vertical.sc()) : _win.pageXOffset || _doc[_scrollLeft] || _docEl[_scrollLeft] || _body[_scrollLeft] || 0;
    })
  },
      _vertical = {
    s: _scrollTop,
    p: "top",
    p2: "Top",
    os: "bottom",
    os2: "Bottom",
    d: "height",
    d2: "Height",
    a: "y",
    op: _horizontal,
    sc: _scrollCacheFunc(function (value) {
      return arguments.length ? _win.scrollTo(_horizontal.sc(), value) : _win.pageYOffset || _doc[_scrollTop] || _docEl[_scrollTop] || _body[_scrollTop] || 0;
    })
  },
      _getTarget = function _getTarget(t) {
    return gsap.utils.toArray(t)[0] || (typeof t === "string" && gsap.config().nullTargetWarn !== false ? console.warn("Element not found:", t) : null);
  },
      _getScrollFunc = function _getScrollFunc(element, _ref) {
    var s = _ref.s,
        sc = _ref.sc;
    _isViewport(element) && (element = _doc.scrollingElement || _docEl);

    var i = _scrollers.indexOf(element),
        offset = sc === _vertical.sc ? 1 : 2;

    !~i && (i = _scrollers.push(element) - 1);
    _scrollers[i + offset] || element.addEventListener("scroll", _onScroll);
    var prev = _scrollers[i + offset],
        func = prev || (_scrollers[i + offset] = _scrollCacheFunc(_getProxyProp(element, s), true) || (_isViewport(element) ? sc : _scrollCacheFunc(function (value) {
      return arguments.length ? element[s] = value : element[s];
    })));
    func.target = element;
    prev || (func.smooth = gsap.getProperty(element, "scrollBehavior") === "smooth");
    return func;
  },
      _getVelocityProp = function _getVelocityProp(value, minTimeRefresh, useDelta) {
    var v1 = value,
        v2 = value,
        t1 = _getTime(),
        t2 = t1,
        min = minTimeRefresh || 50,
        dropToZeroTime = Math.max(500, min * 3),
        update = function update(value, force) {
      var t = _getTime();

      if (force || t - t1 > min) {
        v2 = v1;
        v1 = value;
        t2 = t1;
        t1 = t;
      } else if (useDelta) {
        v1 += value;
      } else {
        v1 = v2 + (value - v2) / (t - t2) * (t1 - t2);
      }
    },
        reset = function reset() {
      v2 = v1 = useDelta ? 0 : v1;
      t2 = t1 = 0;
    },
        getVelocity = function getVelocity(latestValue) {
      var tOld = t2,
          vOld = v2,
          t = _getTime();

      (latestValue || latestValue === 0) && latestValue !== v1 && update(latestValue);
      return t1 === t2 || t - t2 > dropToZeroTime ? 0 : (v1 + (useDelta ? vOld : -vOld)) / ((useDelta ? t : t1) - tOld) * 1000;
    };

    return {
      update: update,
      reset: reset,
      getVelocity: getVelocity
    };
  },
      _getEvent = function _getEvent(e, preventDefault) {
    preventDefault && !e._gsapAllow && e.preventDefault();
    return e.changedTouches ? e.changedTouches[0] : e;
  },
      _getAbsoluteMax = function _getAbsoluteMax(a) {
    var max = Math.max.apply(Math, a),
        min = Math.min.apply(Math, a);
    return Math.abs(max) >= Math.abs(min) ? max : min;
  },
      _setScrollTrigger = function _setScrollTrigger() {
    ScrollTrigger = gsap.core.globals().ScrollTrigger;
    ScrollTrigger && ScrollTrigger.core && _integrate();
  },
      _initCore = function _initCore(core) {
    gsap = core || _getGSAP();

    if (gsap && typeof document !== "undefined" && document.body) {
      _win = window;
      _doc = document;
      _docEl = _doc.documentElement;
      _body = _doc.body;
      _root = [_win, _doc, _docEl, _body];
      _clamp = gsap.utils.clamp;
      _pointerType = "onpointerenter" in _body ? "pointer" : "mouse";
      _isTouch = Observer.isTouch = _win.matchMedia && _win.matchMedia("(hover: none), (pointer: coarse)").matches ? 1 : "ontouchstart" in _win || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0 ? 2 : 0;
      _eventTypes = Observer.eventTypes = ("ontouchstart" in _docEl ? "touchstart,touchmove,touchcancel,touchend" : !("onpointerdown" in _docEl) ? "mousedown,mousemove,mouseup,mouseup" : "pointerdown,pointermove,pointercancel,pointerup").split(",");
      setTimeout(function () {
        return _startup = 0;
      }, 500);

      _setScrollTrigger();

      _coreInitted = 1;
    }

    return _coreInitted;
  };

  _horizontal.op = _vertical;
  _scrollers.cache = 0;
  var Observer = function () {
    function Observer(vars) {
      this.init(vars);
    }

    var _proto = Observer.prototype;

    _proto.init = function init(vars) {
      _coreInitted || _initCore(gsap) || console.warn("Please gsap.registerPlugin(Observer)");
      ScrollTrigger || _setScrollTrigger();
      var tolerance = vars.tolerance,
          dragMinimum = vars.dragMinimum,
          type = vars.type,
          target = vars.target,
          lineHeight = vars.lineHeight,
          debounce = vars.debounce,
          preventDefault = vars.preventDefault,
          onStop = vars.onStop,
          onStopDelay = vars.onStopDelay,
          ignore = vars.ignore,
          wheelSpeed = vars.wheelSpeed,
          event = vars.event,
          onDragStart = vars.onDragStart,
          onDragEnd = vars.onDragEnd,
          onDrag = vars.onDrag,
          onPress = vars.onPress,
          onRelease = vars.onRelease,
          onRight = vars.onRight,
          onLeft = vars.onLeft,
          onUp = vars.onUp,
          onDown = vars.onDown,
          onChangeX = vars.onChangeX,
          onChangeY = vars.onChangeY,
          onChange = vars.onChange,
          onToggleX = vars.onToggleX,
          onToggleY = vars.onToggleY,
          onHover = vars.onHover,
          onHoverEnd = vars.onHoverEnd,
          onMove = vars.onMove,
          ignoreCheck = vars.ignoreCheck,
          isNormalizer = vars.isNormalizer,
          onGestureStart = vars.onGestureStart,
          onGestureEnd = vars.onGestureEnd,
          onWheel = vars.onWheel,
          onEnable = vars.onEnable,
          onDisable = vars.onDisable,
          onClick = vars.onClick,
          scrollSpeed = vars.scrollSpeed,
          capture = vars.capture,
          allowClicks = vars.allowClicks,
          lockAxis = vars.lockAxis,
          onLockAxis = vars.onLockAxis;
      this.target = target = _getTarget(target) || _docEl;
      this.vars = vars;
      ignore && (ignore = gsap.utils.toArray(ignore));
      tolerance = tolerance || 1e-9;
      dragMinimum = dragMinimum || 0;
      wheelSpeed = wheelSpeed || 1;
      scrollSpeed = scrollSpeed || 1;
      type = type || "wheel,touch,pointer";
      debounce = debounce !== false;
      lineHeight || (lineHeight = parseFloat(_win.getComputedStyle(_body).lineHeight) || 22);

      var id,
          onStopDelayedCall,
          dragged,
          moved,
          wheeled,
          locked,
          axis,
          self = this,
          prevDeltaX = 0,
          prevDeltaY = 0,
          scrollFuncX = _getScrollFunc(target, _horizontal),
          scrollFuncY = _getScrollFunc(target, _vertical),
          scrollX = scrollFuncX(),
          scrollY = scrollFuncY(),
          limitToTouch = ~type.indexOf("touch") && !~type.indexOf("pointer") && _eventTypes[0] === "pointerdown",
          isViewport = _isViewport(target),
          ownerDoc = target.ownerDocument || _doc,
          deltaX = [0, 0, 0],
          deltaY = [0, 0, 0],
          onClickTime = 0,
          clickCapture = function clickCapture() {
        return onClickTime = _getTime();
      },
          _ignoreCheck = function _ignoreCheck(e, isPointerOrTouch) {
        return (self.event = e) && ignore && ~ignore.indexOf(e.target) || isPointerOrTouch && limitToTouch && e.pointerType !== "touch" || ignoreCheck && ignoreCheck(e, isPointerOrTouch);
      },
          onStopFunc = function onStopFunc() {
        self._vx.reset();

        self._vy.reset();

        onStopDelayedCall.pause();
        onStop && onStop(self);
      },
          update = function update() {
        var dx = self.deltaX = _getAbsoluteMax(deltaX),
            dy = self.deltaY = _getAbsoluteMax(deltaY),
            changedX = Math.abs(dx) >= tolerance,
            changedY = Math.abs(dy) >= tolerance;

        onChange && (changedX || changedY) && onChange(self, dx, dy, deltaX, deltaY);

        if (changedX) {
          onRight && self.deltaX > 0 && onRight(self);
          onLeft && self.deltaX < 0 && onLeft(self);
          onChangeX && onChangeX(self);
          onToggleX && self.deltaX < 0 !== prevDeltaX < 0 && onToggleX(self);
          prevDeltaX = self.deltaX;
          deltaX[0] = deltaX[1] = deltaX[2] = 0;
        }

        if (changedY) {
          onDown && self.deltaY > 0 && onDown(self);
          onUp && self.deltaY < 0 && onUp(self);
          onChangeY && onChangeY(self);
          onToggleY && self.deltaY < 0 !== prevDeltaY < 0 && onToggleY(self);
          prevDeltaY = self.deltaY;
          deltaY[0] = deltaY[1] = deltaY[2] = 0;
        }

        if (moved || dragged) {
          onMove && onMove(self);

          if (dragged) {
            onDrag(self);
            dragged = false;
          }

          moved = false;
        }

        locked && !(locked = false) && onLockAxis && onLockAxis(self);

        if (wheeled) {
          onWheel(self);
          wheeled = false;
        }

        id = 0;
      },
          onDelta = function onDelta(x, y, index) {
        deltaX[index] += x;
        deltaY[index] += y;

        self._vx.update(x);

        self._vy.update(y);

        debounce ? id || (id = requestAnimationFrame(update)) : update();
      },
          onTouchOrPointerDelta = function onTouchOrPointerDelta(x, y) {
        if (lockAxis && !axis) {
          self.axis = axis = Math.abs(x) > Math.abs(y) ? "x" : "y";
          locked = true;
        }

        if (axis !== "y") {
          deltaX[2] += x;

          self._vx.update(x, true);
        }

        if (axis !== "x") {
          deltaY[2] += y;

          self._vy.update(y, true);
        }

        debounce ? id || (id = requestAnimationFrame(update)) : update();
      },
          _onDrag = function _onDrag(e) {
        if (_ignoreCheck(e, 1)) {
          return;
        }

        e = _getEvent(e, preventDefault);
        var x = e.clientX,
            y = e.clientY,
            dx = x - self.x,
            dy = y - self.y,
            isDragging = self.isDragging;
        self.x = x;
        self.y = y;

        if (isDragging || Math.abs(self.startX - x) >= dragMinimum || Math.abs(self.startY - y) >= dragMinimum) {
          onDrag && (dragged = true);
          isDragging || (self.isDragging = true);
          onTouchOrPointerDelta(dx, dy);
          isDragging || onDragStart && onDragStart(self);
        }
      },
          _onPress = self.onPress = function (e) {
        if (_ignoreCheck(e, 1)) {
          return;
        }

        self.axis = axis = null;
        onStopDelayedCall.pause();
        self.isPressed = true;
        e = _getEvent(e);
        prevDeltaX = prevDeltaY = 0;
        self.startX = self.x = e.clientX;
        self.startY = self.y = e.clientY;

        self._vx.reset();

        self._vy.reset();

        _addListener(isNormalizer ? target : ownerDoc, _eventTypes[1], _onDrag, preventDefault, true);

        self.deltaX = self.deltaY = 0;
        onPress && onPress(self);
      },
          _onRelease = function _onRelease(e) {
        if (_ignoreCheck(e, 1)) {
          return;
        }

        _removeListener(isNormalizer ? target : ownerDoc, _eventTypes[1], _onDrag, true);

        var wasDragging = self.isDragging && (Math.abs(self.x - self.startX) > 3 || Math.abs(self.y - self.startY) > 3),
            eventData = _getEvent(e);

        if (!wasDragging) {
          self._vx.reset();

          self._vy.reset();

          if (preventDefault && allowClicks) {
            gsap.delayedCall(0.08, function () {
              if (_getTime() - onClickTime > 300 && !e.defaultPrevented) {
                if (e.target.click) {
                  e.target.click();
                } else if (ownerDoc.createEvent) {
                  var syntheticEvent = ownerDoc.createEvent("MouseEvents");
                  syntheticEvent.initMouseEvent("click", true, true, _win, 1, eventData.screenX, eventData.screenY, eventData.clientX, eventData.clientY, false, false, false, false, 0, null);
                  e.target.dispatchEvent(syntheticEvent);
                }
              }
            });
          }
        }

        self.isDragging = self.isGesturing = self.isPressed = false;
        onStop && !isNormalizer && onStopDelayedCall.restart(true);
        onDragEnd && wasDragging && onDragEnd(self);
        onRelease && onRelease(self, wasDragging);
      },
          _onGestureStart = function _onGestureStart(e) {
        return e.touches && e.touches.length > 1 && (self.isGesturing = true) && onGestureStart(e, self.isDragging);
      },
          _onGestureEnd = function _onGestureEnd() {
        return (self.isGesturing = false) || onGestureEnd(self);
      },
          onScroll = function onScroll(e) {
        if (_ignoreCheck(e)) {
          return;
        }

        var x = scrollFuncX(),
            y = scrollFuncY();
        onDelta((x - scrollX) * scrollSpeed, (y - scrollY) * scrollSpeed, 1);
        scrollX = x;
        scrollY = y;
        onStop && onStopDelayedCall.restart(true);
      },
          _onWheel = function _onWheel(e) {
        if (_ignoreCheck(e)) {
          return;
        }

        e = _getEvent(e, preventDefault);
        onWheel && (wheeled = true);
        var multiplier = (e.deltaMode === 1 ? lineHeight : e.deltaMode === 2 ? _win.innerHeight : 1) * wheelSpeed;
        onDelta(e.deltaX * multiplier, e.deltaY * multiplier, 0);
        onStop && !isNormalizer && onStopDelayedCall.restart(true);
      },
          _onMove = function _onMove(e) {
        if (_ignoreCheck(e)) {
          return;
        }

        var x = e.clientX,
            y = e.clientY,
            dx = x - self.x,
            dy = y - self.y;
        self.x = x;
        self.y = y;
        moved = true;
        (dx || dy) && onTouchOrPointerDelta(dx, dy);
      },
          _onHover = function _onHover(e) {
        self.event = e;
        onHover(self);
      },
          _onHoverEnd = function _onHoverEnd(e) {
        self.event = e;
        onHoverEnd(self);
      },
          _onClick = function _onClick(e) {
        return _ignoreCheck(e) || _getEvent(e, preventDefault) && onClick(self);
      };

      onStopDelayedCall = self._dc = gsap.delayedCall(onStopDelay || 0.25, onStopFunc).pause();
      self.deltaX = self.deltaY = 0;
      self._vx = _getVelocityProp(0, 50, true);
      self._vy = _getVelocityProp(0, 50, true);
      self.scrollX = scrollFuncX;
      self.scrollY = scrollFuncY;
      self.isDragging = self.isGesturing = self.isPressed = false;

      self.enable = function (e) {
        if (!self.isEnabled) {
          _addListener(isViewport ? ownerDoc : target, "scroll", _onScroll);

          type.indexOf("scroll") >= 0 && _addListener(isViewport ? ownerDoc : target, "scroll", onScroll, preventDefault, capture);
          type.indexOf("wheel") >= 0 && _addListener(target, "wheel", _onWheel, preventDefault, capture);

          if (type.indexOf("touch") >= 0 && _isTouch || type.indexOf("pointer") >= 0) {
            _addListener(target, _eventTypes[0], _onPress, preventDefault, capture);

            _addListener(ownerDoc, _eventTypes[2], _onRelease);

            _addListener(ownerDoc, _eventTypes[3], _onRelease);

            allowClicks && _addListener(target, "click", clickCapture, false, true);
            onClick && _addListener(target, "click", _onClick);
            onGestureStart && _addListener(ownerDoc, "gesturestart", _onGestureStart);
            onGestureEnd && _addListener(ownerDoc, "gestureend", _onGestureEnd);
            onHover && _addListener(target, _pointerType + "enter", _onHover);
            onHoverEnd && _addListener(target, _pointerType + "leave", _onHoverEnd);
            onMove && _addListener(target, _pointerType + "move", _onMove);
          }

          self.isEnabled = true;
          e && e.type && _onPress(e);
          onEnable && onEnable(self);
        }

        return self;
      };

      self.disable = function () {
        if (self.isEnabled) {
          _observers.filter(function (o) {
            return o !== self && _isViewport(o.target);
          }).length || _removeListener(isViewport ? ownerDoc : target, "scroll", _onScroll);

          if (self.isPressed) {
            self._vx.reset();

            self._vy.reset();

            _removeListener(isNormalizer ? target : ownerDoc, _eventTypes[1], _onDrag, true);
          }

          _removeListener(isViewport ? ownerDoc : target, "scroll", onScroll, capture);

          _removeListener(target, "wheel", _onWheel, capture);

          _removeListener(target, _eventTypes[0], _onPress, capture);

          _removeListener(ownerDoc, _eventTypes[2], _onRelease);

          _removeListener(ownerDoc, _eventTypes[3], _onRelease);

          _removeListener(target, "click", clickCapture, true);

          _removeListener(target, "click", _onClick);

          _removeListener(ownerDoc, "gesturestart", _onGestureStart);

          _removeListener(ownerDoc, "gestureend", _onGestureEnd);

          _removeListener(target, _pointerType + "enter", _onHover);

          _removeListener(target, _pointerType + "leave", _onHoverEnd);

          _removeListener(target, _pointerType + "move", _onMove);

          self.isEnabled = self.isPressed = self.isDragging = false;
          onDisable && onDisable(self);
        }
      };

      self.kill = function () {
        self.disable();

        var i = _observers.indexOf(self);

        i >= 0 && _observers.splice(i, 1);
        _normalizer === self && (_normalizer = 0);
      };

      _observers.push(self);

      isNormalizer && _isViewport(target) && (_normalizer = self);
      self.enable(event);
    };

    _createClass(Observer, [{
      key: "velocityX",
      get: function get() {
        return this._vx.getVelocity();
      }
    }, {
      key: "velocityY",
      get: function get() {
        return this._vy.getVelocity();
      }
    }]);

    return Observer;
  }();
  Observer.version = "3.11.3";

  Observer.create = function (vars) {
    return new Observer(vars);
  };

  Observer.register = _initCore;

  Observer.getAll = function () {
    return _observers.slice();
  };

  Observer.getById = function (id) {
    return _observers.filter(function (o) {
      return o.vars.id === id;
    })[0];
  };

  _getGSAP() && gsap.registerPlugin(Observer);

  /*!
   * ScrollTrigger 3.11.3
   * https://greensock.com
   *
   * @license Copyright 2008-2022, GreenSock. All rights reserved.
   * Subject to the terms at https://greensock.com/standard-license or for
   * Club GreenSock members, the agreement issued with that membership.
   * @author: Jack Doyle, jack@greensock.com
  */

  var gsap$1,
      _coreInitted$1,
      _win$1,
      _doc$1,
      _docEl$1,
      _body$1,
      _root$1,
      _resizeDelay,
      _toArray,
      _clamp$1,
      _time2,
      _syncInterval,
      _refreshing,
      _pointerIsDown,
      _transformProp,
      _i,
      _prevWidth,
      _prevHeight,
      _autoRefresh,
      _sort,
      _suppressOverwrites,
      _ignoreResize,
      _normalizer$1,
      _ignoreMobileResize,
      _baseScreenHeight,
      _baseScreenWidth,
      _fixIOSBug,
      _context,
      _scrollRestoration,
      _limitCallbacks,
      _startup$1 = 1,
      _getTime$1 = Date.now,
      _time1 = _getTime$1(),
      _lastScrollTime = 0,
      _enabled = 0,
      _pointerDownHandler = function _pointerDownHandler() {
    return _pointerIsDown = 1;
  },
      _pointerUpHandler = function _pointerUpHandler() {
    return _pointerIsDown = 0;
  },
      _passThrough = function _passThrough(v) {
    return v;
  },
      _round = function _round(value) {
    return Math.round(value * 100000) / 100000 || 0;
  },
      _windowExists = function _windowExists() {
    return typeof window !== "undefined";
  },
      _getGSAP$1 = function _getGSAP() {
    return gsap$1 || _windowExists() && (gsap$1 = window.gsap) && gsap$1.registerPlugin && gsap$1;
  },
      _isViewport$1 = function _isViewport(e) {
    return !!~_root$1.indexOf(e);
  },
      _getBoundsFunc = function _getBoundsFunc(element) {
    return _getProxyProp(element, "getBoundingClientRect") || (_isViewport$1(element) ? function () {
      _winOffsets.width = _win$1.innerWidth;
      _winOffsets.height = _win$1.innerHeight;
      return _winOffsets;
    } : function () {
      return _getBounds(element);
    });
  },
      _getSizeFunc = function _getSizeFunc(scroller, isViewport, _ref) {
    var d = _ref.d,
        d2 = _ref.d2,
        a = _ref.a;
    return (a = _getProxyProp(scroller, "getBoundingClientRect")) ? function () {
      return a()[d];
    } : function () {
      return (isViewport ? _win$1["inner" + d2] : scroller["client" + d2]) || 0;
    };
  },
      _getOffsetsFunc = function _getOffsetsFunc(element, isViewport) {
    return !isViewport || ~_proxies.indexOf(element) ? _getBoundsFunc(element) : function () {
      return _winOffsets;
    };
  },
      _maxScroll = function _maxScroll(element, _ref2) {
    var s = _ref2.s,
        d2 = _ref2.d2,
        d = _ref2.d,
        a = _ref2.a;
    return (s = "scroll" + d2) && (a = _getProxyProp(element, s)) ? a() - _getBoundsFunc(element)()[d] : _isViewport$1(element) ? (_docEl$1[s] || _body$1[s]) - (_win$1["inner" + d2] || _docEl$1["client" + d2] || _body$1["client" + d2]) : element[s] - element["offset" + d2];
  },
      _iterateAutoRefresh = function _iterateAutoRefresh(func, events) {
    for (var i = 0; i < _autoRefresh.length; i += 3) {
      (!events || ~events.indexOf(_autoRefresh[i + 1])) && func(_autoRefresh[i], _autoRefresh[i + 1], _autoRefresh[i + 2]);
    }
  },
      _isString = function _isString(value) {
    return typeof value === "string";
  },
      _isFunction = function _isFunction(value) {
    return typeof value === "function";
  },
      _isNumber = function _isNumber(value) {
    return typeof value === "number";
  },
      _isObject = function _isObject(value) {
    return typeof value === "object";
  },
      _endAnimation = function _endAnimation(animation, reversed, pause) {
    return animation && animation.progress(reversed ? 0 : 1) && pause && animation.pause();
  },
      _callback = function _callback(self, func) {
    if (self.enabled) {
      var result = func(self);
      result && result.totalTime && (self.callbackAnimation = result);
    }
  },
      _abs = Math.abs,
      _left = "left",
      _top = "top",
      _right = "right",
      _bottom = "bottom",
      _width = "width",
      _height = "height",
      _Right = "Right",
      _Left = "Left",
      _Top = "Top",
      _Bottom = "Bottom",
      _padding = "padding",
      _margin = "margin",
      _Width = "Width",
      _Height = "Height",
      _px = "px",
      _getComputedStyle = function _getComputedStyle(element) {
    return _win$1.getComputedStyle(element);
  },
      _makePositionable = function _makePositionable(element) {
    var position = _getComputedStyle(element).position;

    element.style.position = position === "absolute" || position === "fixed" ? position : "relative";
  },
      _setDefaults = function _setDefaults(obj, defaults) {
    for (var p in defaults) {
      p in obj || (obj[p] = defaults[p]);
    }

    return obj;
  },
      _getBounds = function _getBounds(element, withoutTransforms) {
    var tween = withoutTransforms && _getComputedStyle(element)[_transformProp] !== "matrix(1, 0, 0, 1, 0, 0)" && gsap$1.to(element, {
      x: 0,
      y: 0,
      xPercent: 0,
      yPercent: 0,
      rotation: 0,
      rotationX: 0,
      rotationY: 0,
      scale: 1,
      skewX: 0,
      skewY: 0
    }).progress(1),
        bounds = element.getBoundingClientRect();
    tween && tween.progress(0).kill();
    return bounds;
  },
      _getSize = function _getSize(element, _ref3) {
    var d2 = _ref3.d2;
    return element["offset" + d2] || element["client" + d2] || 0;
  },
      _getLabelRatioArray = function _getLabelRatioArray(timeline) {
    var a = [],
        labels = timeline.labels,
        duration = timeline.duration(),
        p;

    for (p in labels) {
      a.push(labels[p] / duration);
    }

    return a;
  },
      _getClosestLabel = function _getClosestLabel(animation) {
    return function (value) {
      return gsap$1.utils.snap(_getLabelRatioArray(animation), value);
    };
  },
      _snapDirectional = function _snapDirectional(snapIncrementOrArray) {
    var snap = gsap$1.utils.snap(snapIncrementOrArray),
        a = Array.isArray(snapIncrementOrArray) && snapIncrementOrArray.slice(0).sort(function (a, b) {
      return a - b;
    });
    return a ? function (value, direction, threshold) {
      if (threshold === void 0) {
        threshold = 1e-3;
      }

      var i;

      if (!direction) {
        return snap(value);
      }

      if (direction > 0) {
        value -= threshold;

        for (i = 0; i < a.length; i++) {
          if (a[i] >= value) {
            return a[i];
          }
        }

        return a[i - 1];
      } else {
        i = a.length;
        value += threshold;

        while (i--) {
          if (a[i] <= value) {
            return a[i];
          }
        }
      }

      return a[0];
    } : function (value, direction, threshold) {
      if (threshold === void 0) {
        threshold = 1e-3;
      }

      var snapped = snap(value);
      return !direction || Math.abs(snapped - value) < threshold || snapped - value < 0 === direction < 0 ? snapped : snap(direction < 0 ? value - snapIncrementOrArray : value + snapIncrementOrArray);
    };
  },
      _getLabelAtDirection = function _getLabelAtDirection(timeline) {
    return function (value, st) {
      return _snapDirectional(_getLabelRatioArray(timeline))(value, st.direction);
    };
  },
      _multiListener = function _multiListener(func, element, types, callback) {
    return types.split(",").forEach(function (type) {
      return func(element, type, callback);
    });
  },
      _addListener$1 = function _addListener(element, type, func, nonPassive, capture) {
    return element.addEventListener(type, func, {
      passive: !nonPassive,
      capture: !!capture
    });
  },
      _removeListener$1 = function _removeListener(element, type, func, capture) {
    return element.removeEventListener(type, func, !!capture);
  },
      _wheelListener = function _wheelListener(func, el, scrollFunc) {
    return scrollFunc && scrollFunc.wheelHandler && func(el, "wheel", scrollFunc);
  },
      _markerDefaults = {
    startColor: "green",
    endColor: "red",
    indent: 0,
    fontSize: "16px",
    fontWeight: "normal"
  },
      _defaults = {
    toggleActions: "play",
    anticipatePin: 0
  },
      _keywords = {
    top: 0,
    left: 0,
    center: 0.5,
    bottom: 1,
    right: 1
  },
      _offsetToPx = function _offsetToPx(value, size) {
    if (_isString(value)) {
      var eqIndex = value.indexOf("="),
          relative = ~eqIndex ? +(value.charAt(eqIndex - 1) + 1) * parseFloat(value.substr(eqIndex + 1)) : 0;

      if (~eqIndex) {
        value.indexOf("%") > eqIndex && (relative *= size / 100);
        value = value.substr(0, eqIndex - 1);
      }

      value = relative + (value in _keywords ? _keywords[value] * size : ~value.indexOf("%") ? parseFloat(value) * size / 100 : parseFloat(value) || 0);
    }

    return value;
  },
      _createMarker = function _createMarker(type, name, container, direction, _ref4, offset, matchWidthEl, containerAnimation) {
    var startColor = _ref4.startColor,
        endColor = _ref4.endColor,
        fontSize = _ref4.fontSize,
        indent = _ref4.indent,
        fontWeight = _ref4.fontWeight;

    var e = _doc$1.createElement("div"),
        useFixedPosition = _isViewport$1(container) || _getProxyProp(container, "pinType") === "fixed",
        isScroller = type.indexOf("scroller") !== -1,
        parent = useFixedPosition ? _body$1 : container,
        isStart = type.indexOf("start") !== -1,
        color = isStart ? startColor : endColor,
        css = "border-color:" + color + ";font-size:" + fontSize + ";color:" + color + ";font-weight:" + fontWeight + ";pointer-events:none;white-space:nowrap;font-family:sans-serif,Arial;z-index:1000;padding:4px 8px;border-width:0;border-style:solid;";

    css += "position:" + ((isScroller || containerAnimation) && useFixedPosition ? "fixed;" : "absolute;");
    (isScroller || containerAnimation || !useFixedPosition) && (css += (direction === _vertical ? _right : _bottom) + ":" + (offset + parseFloat(indent)) + "px;");
    matchWidthEl && (css += "box-sizing:border-box;text-align:left;width:" + matchWidthEl.offsetWidth + "px;");
    e._isStart = isStart;
    e.setAttribute("class", "gsap-marker-" + type + (name ? " marker-" + name : ""));
    e.style.cssText = css;
    e.innerText = name || name === 0 ? type + "-" + name : type;
    parent.children[0] ? parent.insertBefore(e, parent.children[0]) : parent.appendChild(e);
    e._offset = e["offset" + direction.op.d2];

    _positionMarker(e, 0, direction, isStart);

    return e;
  },
      _positionMarker = function _positionMarker(marker, start, direction, flipped) {
    var vars = {
      display: "block"
    },
        side = direction[flipped ? "os2" : "p2"],
        oppositeSide = direction[flipped ? "p2" : "os2"];
    marker._isFlipped = flipped;
    vars[direction.a + "Percent"] = flipped ? -100 : 0;
    vars[direction.a] = flipped ? "1px" : 0;
    vars["border" + side + _Width] = 1;
    vars["border" + oppositeSide + _Width] = 0;
    vars[direction.p] = start + "px";
    gsap$1.set(marker, vars);
  },
      _triggers = [],
      _ids = {},
      _rafID,
      _sync = function _sync() {
    return _getTime$1() - _lastScrollTime > 34 && (_rafID || (_rafID = requestAnimationFrame(_updateAll)));
  },
      _onScroll$1 = function _onScroll() {
    if (!_normalizer$1 || !_normalizer$1.isPressed || _normalizer$1.startX > _body$1.clientWidth) {
      _scrollers.cache++;

      if (_normalizer$1) {
        _rafID || (_rafID = requestAnimationFrame(_updateAll));
      } else {
        _updateAll();
      }

      _lastScrollTime || _dispatch("scrollStart");
      _lastScrollTime = _getTime$1();
    }
  },
      _setBaseDimensions = function _setBaseDimensions() {
    _baseScreenWidth = _win$1.innerWidth;
    _baseScreenHeight = _win$1.innerHeight;
  },
      _onResize = function _onResize() {
    _scrollers.cache++;
    !_refreshing && !_ignoreResize && !_doc$1.fullscreenElement && !_doc$1.webkitFullscreenElement && (!_ignoreMobileResize || _baseScreenWidth !== _win$1.innerWidth || Math.abs(_win$1.innerHeight - _baseScreenHeight) > _win$1.innerHeight * 0.25) && _resizeDelay.restart(true);
  },
      _listeners = {},
      _emptyArray = [],
      _softRefresh = function _softRefresh() {
    return _removeListener$1(ScrollTrigger$1, "scrollEnd", _softRefresh) || _refreshAll(true);
  },
      _dispatch = function _dispatch(type) {
    return _listeners[type] && _listeners[type].map(function (f) {
      return f();
    }) || _emptyArray;
  },
      _savedStyles = [],
      _revertRecorded = function _revertRecorded(media) {
    for (var i = 0; i < _savedStyles.length; i += 5) {
      if (!media || _savedStyles[i + 4] && _savedStyles[i + 4].query === media) {
        _savedStyles[i].style.cssText = _savedStyles[i + 1];
        _savedStyles[i].getBBox && _savedStyles[i].setAttribute("transform", _savedStyles[i + 2] || "");
        _savedStyles[i + 3].uncache = 1;
      }
    }
  },
      _revertAll = function _revertAll(kill, media) {
    var trigger;

    for (_i = 0; _i < _triggers.length; _i++) {
      trigger = _triggers[_i];

      if (trigger && (!media || trigger._ctx === media)) {
        if (kill) {
          trigger.kill(1);
        } else {
          trigger.revert(true, true);
        }
      }
    }

    media && _revertRecorded(media);
    media || _dispatch("revert");
  },
      _clearScrollMemory = function _clearScrollMemory(scrollRestoration, force) {
    _scrollers.cache++;
    (force || !_refreshingAll) && _scrollers.forEach(function (obj) {
      return _isFunction(obj) && obj.cacheID++ && (obj.rec = 0);
    });
    _isString(scrollRestoration) && (_win$1.history.scrollRestoration = _scrollRestoration = scrollRestoration);
  },
      _refreshingAll,
      _refreshID = 0,
      _queueRefreshID,
      _queueRefreshAll = function _queueRefreshAll() {
    if (_queueRefreshID !== _refreshID) {
      var id = _queueRefreshID = _refreshID;
      requestAnimationFrame(function () {
        return id === _refreshID && _refreshAll(true);
      });
    }
  },
      _refreshAll = function _refreshAll(force, skipRevert) {
    if (_lastScrollTime && !force) {
      _addListener$1(ScrollTrigger$1, "scrollEnd", _softRefresh);

      return;
    }

    _refreshingAll = ScrollTrigger$1.isRefreshing = true;

    _scrollers.forEach(function (obj) {
      return _isFunction(obj) && obj.cacheID++ && (obj.rec = obj());
    });

    var refreshInits = _dispatch("refreshInit");

    _sort && ScrollTrigger$1.sort();
    skipRevert || _revertAll();

    _scrollers.forEach(function (obj) {
      if (_isFunction(obj)) {
        obj.smooth && (obj.target.style.scrollBehavior = "auto");
        obj(0);
      }
    });

    _triggers.slice(0).forEach(function (t) {
      return t.refresh();
    });

    _triggers.forEach(function (t, i) {
      if (t._subPinOffset && t.pin) {
        var prop = t.vars.horizontal ? "offsetWidth" : "offsetHeight",
            original = t.pin[prop];
        t.revert(true, 1);
        t.adjustPinSpacing(t.pin[prop] - original);
        t.revert(false, 1);
      }
    });

    _triggers.forEach(function (t) {
      return t.vars.end === "max" && t.setPositions(t.start, Math.max(t.start + 1, _maxScroll(t.scroller, t._dir)));
    });

    refreshInits.forEach(function (result) {
      return result && result.render && result.render(-1);
    });

    _scrollers.forEach(function (obj) {
      if (_isFunction(obj)) {
        obj.smooth && requestAnimationFrame(function () {
          return obj.target.style.scrollBehavior = "smooth";
        });
        obj.rec && obj(obj.rec);
      }
    });

    _clearScrollMemory(_scrollRestoration, 1);

    _resizeDelay.pause();

    _refreshID++;

    _updateAll(2);

    _triggers.forEach(function (t) {
      return _isFunction(t.vars.onRefresh) && t.vars.onRefresh(t);
    });

    _refreshingAll = ScrollTrigger$1.isRefreshing = false;

    _dispatch("refresh");
  },
      _lastScroll = 0,
      _direction = 1,
      _primary,
      _updateAll = function _updateAll(force) {
    if (!_refreshingAll || force === 2) {
      ScrollTrigger$1.isUpdating = true;
      _primary && _primary.update(0);

      var l = _triggers.length,
          time = _getTime$1(),
          recordVelocity = time - _time1 >= 50,
          scroll = l && _triggers[0].scroll();

      _direction = _lastScroll > scroll ? -1 : 1;
      _lastScroll = scroll;

      if (recordVelocity) {
        if (_lastScrollTime && !_pointerIsDown && time - _lastScrollTime > 200) {
          _lastScrollTime = 0;

          _dispatch("scrollEnd");
        }

        _time2 = _time1;
        _time1 = time;
      }

      if (_direction < 0) {
        _i = l;

        while (_i-- > 0) {
          _triggers[_i] && _triggers[_i].update(0, recordVelocity);
        }

        _direction = 1;
      } else {
        for (_i = 0; _i < l; _i++) {
          _triggers[_i] && _triggers[_i].update(0, recordVelocity);
        }
      }

      ScrollTrigger$1.isUpdating = false;
    }

    _rafID = 0;
  },
      _propNamesToCopy = [_left, _top, _bottom, _right, _margin + _Bottom, _margin + _Right, _margin + _Top, _margin + _Left, "display", "flexShrink", "float", "zIndex", "gridColumnStart", "gridColumnEnd", "gridRowStart", "gridRowEnd", "gridArea", "justifySelf", "alignSelf", "placeSelf", "order"],
      _stateProps = _propNamesToCopy.concat([_width, _height, "boxSizing", "max" + _Width, "max" + _Height, "position", _margin, _padding, _padding + _Top, _padding + _Right, _padding + _Bottom, _padding + _Left]),
      _swapPinOut = function _swapPinOut(pin, spacer, state) {
    _setState(state);

    var cache = pin._gsap;

    if (cache.spacerIsNative) {
      _setState(cache.spacerState);
    } else if (pin._gsap.swappedIn) {
      var parent = spacer.parentNode;

      if (parent) {
        parent.insertBefore(pin, spacer);
        parent.removeChild(spacer);
      }
    }

    pin._gsap.swappedIn = false;
  },
      _swapPinIn = function _swapPinIn(pin, spacer, cs, spacerState) {
    if (!pin._gsap.swappedIn) {
      var i = _propNamesToCopy.length,
          spacerStyle = spacer.style,
          pinStyle = pin.style,
          p;

      while (i--) {
        p = _propNamesToCopy[i];
        spacerStyle[p] = cs[p];
      }

      spacerStyle.position = cs.position === "absolute" ? "absolute" : "relative";
      cs.display === "inline" && (spacerStyle.display = "inline-block");
      pinStyle[_bottom] = pinStyle[_right] = "auto";
      spacerStyle.flexBasis = cs.flexBasis || "auto";
      spacerStyle.overflow = "visible";
      spacerStyle.boxSizing = "border-box";
      spacerStyle[_width] = _getSize(pin, _horizontal) + _px;
      spacerStyle[_height] = _getSize(pin, _vertical) + _px;
      spacerStyle[_padding] = pinStyle[_margin] = pinStyle[_top] = pinStyle[_left] = "0";

      _setState(spacerState);

      pinStyle[_width] = pinStyle["max" + _Width] = cs[_width];
      pinStyle[_height] = pinStyle["max" + _Height] = cs[_height];
      pinStyle[_padding] = cs[_padding];

      if (pin.parentNode !== spacer) {
        pin.parentNode.insertBefore(spacer, pin);
        spacer.appendChild(pin);
      }

      pin._gsap.swappedIn = true;
    }
  },
      _capsExp = /([A-Z])/g,
      _setState = function _setState(state) {
    if (state) {
      var style = state.t.style,
          l = state.length,
          i = 0,
          p,
          value;
      (state.t._gsap || gsap$1.core.getCache(state.t)).uncache = 1;

      for (; i < l; i += 2) {
        value = state[i + 1];
        p = state[i];

        if (value) {
          style[p] = value;
        } else if (style[p]) {
          style.removeProperty(p.replace(_capsExp, "-$1").toLowerCase());
        }
      }
    }
  },
      _getState = function _getState(element) {
    var l = _stateProps.length,
        style = element.style,
        state = [],
        i = 0;

    for (; i < l; i++) {
      state.push(_stateProps[i], style[_stateProps[i]]);
    }

    state.t = element;
    return state;
  },
      _copyState = function _copyState(state, override, omitOffsets) {
    var result = [],
        l = state.length,
        i = omitOffsets ? 8 : 0,
        p;

    for (; i < l; i += 2) {
      p = state[i];
      result.push(p, p in override ? override[p] : state[i + 1]);
    }

    result.t = state.t;
    return result;
  },
      _winOffsets = {
    left: 0,
    top: 0
  },
      _parsePosition = function _parsePosition(value, trigger, scrollerSize, direction, scroll, marker, markerScroller, self, scrollerBounds, borderWidth, useFixedPosition, scrollerMax, containerAnimation) {
    _isFunction(value) && (value = value(self));

    if (_isString(value) && value.substr(0, 3) === "max") {
      value = scrollerMax + (value.charAt(4) === "=" ? _offsetToPx("0" + value.substr(3), scrollerSize) : 0);
    }

    var time = containerAnimation ? containerAnimation.time() : 0,
        p1,
        p2,
        element;
    containerAnimation && containerAnimation.seek(0);

    if (!_isNumber(value)) {
      _isFunction(trigger) && (trigger = trigger(self));
      var offsets = (value || "0").split(" "),
          bounds,
          localOffset,
          globalOffset,
          display;
      element = _getTarget(trigger) || _body$1;
      bounds = _getBounds(element) || {};

      if ((!bounds || !bounds.left && !bounds.top) && _getComputedStyle(element).display === "none") {
        display = element.style.display;
        element.style.display = "block";
        bounds = _getBounds(element);
        display ? element.style.display = display : element.style.removeProperty("display");
      }

      localOffset = _offsetToPx(offsets[0], bounds[direction.d]);
      globalOffset = _offsetToPx(offsets[1] || "0", scrollerSize);
      value = bounds[direction.p] - scrollerBounds[direction.p] - borderWidth + localOffset + scroll - globalOffset;
      markerScroller && _positionMarker(markerScroller, globalOffset, direction, scrollerSize - globalOffset < 20 || markerScroller._isStart && globalOffset > 20);
      scrollerSize -= scrollerSize - globalOffset;
    } else if (markerScroller) {
      _positionMarker(markerScroller, scrollerSize, direction, true);
    }

    if (marker) {
      var position = value + scrollerSize,
          isStart = marker._isStart;
      p1 = "scroll" + direction.d2;

      _positionMarker(marker, position, direction, isStart && position > 20 || !isStart && (useFixedPosition ? Math.max(_body$1[p1], _docEl$1[p1]) : marker.parentNode[p1]) <= position + 1);

      if (useFixedPosition) {
        scrollerBounds = _getBounds(markerScroller);
        useFixedPosition && (marker.style[direction.op.p] = scrollerBounds[direction.op.p] - direction.op.m - marker._offset + _px);
      }
    }

    if (containerAnimation && element) {
      p1 = _getBounds(element);
      containerAnimation.seek(scrollerMax);
      p2 = _getBounds(element);
      containerAnimation._caScrollDist = p1[direction.p] - p2[direction.p];
      value = value / containerAnimation._caScrollDist * scrollerMax;
    }

    containerAnimation && containerAnimation.seek(time);
    return containerAnimation ? value : Math.round(value);
  },
      _prefixExp = /(webkit|moz|length|cssText|inset)/i,
      _reparent = function _reparent(element, parent, top, left) {
    if (element.parentNode !== parent) {
      var style = element.style,
          p,
          cs;

      if (parent === _body$1) {
        element._stOrig = style.cssText;
        cs = _getComputedStyle(element);

        for (p in cs) {
          if (!+p && !_prefixExp.test(p) && cs[p] && typeof style[p] === "string" && p !== "0") {
            style[p] = cs[p];
          }
        }

        style.top = top;
        style.left = left;
      } else {
        style.cssText = element._stOrig;
      }

      gsap$1.core.getCache(element).uncache = 1;
      parent.appendChild(element);
    }
  },
      _getTweenCreator = function _getTweenCreator(scroller, direction) {
    var getScroll = _getScrollFunc(scroller, direction),
        prop = "_scroll" + direction.p2,
        lastScroll1,
        lastScroll2,
        getTween = function getTween(scrollTo, vars, initialValue, change1, change2) {
      var tween = getTween.tween,
          onComplete = vars.onComplete,
          modifiers = {};
      initialValue = initialValue || getScroll();
      change2 = change1 && change2 || 0;
      change1 = change1 || scrollTo - initialValue;
      tween && tween.kill();
      lastScroll1 = Math.round(initialValue);
      vars[prop] = scrollTo;
      vars.modifiers = modifiers;

      modifiers[prop] = function (value) {
        value = Math.round(getScroll());

        if (value !== lastScroll1 && value !== lastScroll2 && Math.abs(value - lastScroll1) > 3 && Math.abs(value - lastScroll2) > 3) {
          tween.kill();
          getTween.tween = 0;
        } else {
          value = initialValue + change1 * tween.ratio + change2 * tween.ratio * tween.ratio;
        }

        lastScroll2 = lastScroll1;
        return lastScroll1 = Math.round(value);
      };

      vars.onComplete = function () {
        getTween.tween = 0;
        onComplete && onComplete.call(tween);
      };

      tween = getTween.tween = gsap$1.to(scroller, vars);
      return tween;
    };

    scroller[prop] = getScroll;

    getScroll.wheelHandler = function () {
      return getTween.tween && getTween.tween.kill() && (getTween.tween = 0);
    };

    _addListener$1(scroller, "wheel", getScroll.wheelHandler);

    return getTween;
  };

  var ScrollTrigger$1 = function () {
    function ScrollTrigger(vars, animation) {
      _coreInitted$1 || ScrollTrigger.register(gsap$1) || console.warn("Please gsap.registerPlugin(ScrollTrigger)");
      this.init(vars, animation);
    }

    var _proto = ScrollTrigger.prototype;

    _proto.init = function init(vars, animation) {
      this.progress = this.start = 0;
      this.vars && this.kill(true, true);

      if (!_enabled) {
        this.update = this.refresh = this.kill = _passThrough;
        return;
      }

      vars = _setDefaults(_isString(vars) || _isNumber(vars) || vars.nodeType ? {
        trigger: vars
      } : vars, _defaults);

      var _vars = vars,
          onUpdate = _vars.onUpdate,
          toggleClass = _vars.toggleClass,
          id = _vars.id,
          onToggle = _vars.onToggle,
          onRefresh = _vars.onRefresh,
          scrub = _vars.scrub,
          trigger = _vars.trigger,
          pin = _vars.pin,
          pinSpacing = _vars.pinSpacing,
          invalidateOnRefresh = _vars.invalidateOnRefresh,
          anticipatePin = _vars.anticipatePin,
          onScrubComplete = _vars.onScrubComplete,
          onSnapComplete = _vars.onSnapComplete,
          once = _vars.once,
          snap = _vars.snap,
          pinReparent = _vars.pinReparent,
          pinSpacer = _vars.pinSpacer,
          containerAnimation = _vars.containerAnimation,
          fastScrollEnd = _vars.fastScrollEnd,
          preventOverlaps = _vars.preventOverlaps,
          direction = vars.horizontal || vars.containerAnimation && vars.horizontal !== false ? _horizontal : _vertical,
          isToggle = !scrub && scrub !== 0,
          scroller = _getTarget(vars.scroller || _win$1),
          scrollerCache = gsap$1.core.getCache(scroller),
          isViewport = _isViewport$1(scroller),
          useFixedPosition = ("pinType" in vars ? vars.pinType : _getProxyProp(scroller, "pinType") || isViewport && "fixed") === "fixed",
          callbacks = [vars.onEnter, vars.onLeave, vars.onEnterBack, vars.onLeaveBack],
          toggleActions = isToggle && vars.toggleActions.split(" "),
          markers = "markers" in vars ? vars.markers : _defaults.markers,
          borderWidth = isViewport ? 0 : parseFloat(_getComputedStyle(scroller)["border" + direction.p2 + _Width]) || 0,
          self = this,
          onRefreshInit = vars.onRefreshInit && function () {
        return vars.onRefreshInit(self);
      },
          getScrollerSize = _getSizeFunc(scroller, isViewport, direction),
          getScrollerOffsets = _getOffsetsFunc(scroller, isViewport),
          lastSnap = 0,
          lastRefresh = 0,
          scrollFunc = _getScrollFunc(scroller, direction),
          tweenTo,
          pinCache,
          snapFunc,
          scroll1,
          scroll2,
          start,
          end,
          markerStart,
          markerEnd,
          markerStartTrigger,
          markerEndTrigger,
          markerVars,
          change,
          pinOriginalState,
          pinActiveState,
          pinState,
          spacer,
          offset,
          pinGetter,
          pinSetter,
          pinStart,
          pinChange,
          spacingStart,
          spacerState,
          markerStartSetter,
          markerEndSetter,
          cs,
          snap1,
          snap2,
          scrubTween,
          scrubSmooth,
          snapDurClamp,
          snapDelayedCall,
          prevProgress,
          prevScroll,
          prevAnimProgress,
          caMarkerSetter,
          customRevertReturn;

      _context(self);

      self._dir = direction;
      anticipatePin *= 45;
      self.scroller = scroller;
      self.scroll = containerAnimation ? containerAnimation.time.bind(containerAnimation) : scrollFunc;
      scroll1 = scrollFunc();
      self.vars = vars;
      animation = animation || vars.animation;

      if ("refreshPriority" in vars) {
        _sort = 1;
        vars.refreshPriority === -9999 && (_primary = self);
      }

      scrollerCache.tweenScroll = scrollerCache.tweenScroll || {
        top: _getTweenCreator(scroller, _vertical),
        left: _getTweenCreator(scroller, _horizontal)
      };
      self.tweenTo = tweenTo = scrollerCache.tweenScroll[direction.p];

      self.scrubDuration = function (value) {
        scrubSmooth = _isNumber(value) && value;

        if (!scrubSmooth) {
          scrubTween && scrubTween.progress(1).kill();
          scrubTween = 0;
        } else {
          scrubTween ? scrubTween.duration(value) : scrubTween = gsap$1.to(animation, {
            ease: "expo",
            totalProgress: "+=0.001",
            duration: scrubSmooth,
            paused: true,
            onComplete: function onComplete() {
              return onScrubComplete && onScrubComplete(self);
            }
          });
        }
      };

      if (animation) {
        animation.vars.lazy = false;
        animation._initted || animation.vars.immediateRender !== false && vars.immediateRender !== false && animation.duration() && animation.render(0, true, true);
        self.animation = animation.pause();
        animation.scrollTrigger = self;
        self.scrubDuration(scrub);
        snap1 = 0;
        id || (id = animation.vars.id);
      }

      _triggers.push(self);

      if (snap) {
        if (!_isObject(snap) || snap.push) {
          snap = {
            snapTo: snap
          };
        }

        "scrollBehavior" in _body$1.style && gsap$1.set(isViewport ? [_body$1, _docEl$1] : scroller, {
          scrollBehavior: "auto"
        });

        _scrollers.forEach(function (o) {
          return _isFunction(o) && o.target === (isViewport ? _doc$1.scrollingElement || _docEl$1 : scroller) && (o.smooth = false);
        });

        snapFunc = _isFunction(snap.snapTo) ? snap.snapTo : snap.snapTo === "labels" ? _getClosestLabel(animation) : snap.snapTo === "labelsDirectional" ? _getLabelAtDirection(animation) : snap.directional !== false ? function (value, st) {
          return _snapDirectional(snap.snapTo)(value, _getTime$1() - lastRefresh < 500 ? 0 : st.direction);
        } : gsap$1.utils.snap(snap.snapTo);
        snapDurClamp = snap.duration || {
          min: 0.1,
          max: 2
        };
        snapDurClamp = _isObject(snapDurClamp) ? _clamp$1(snapDurClamp.min, snapDurClamp.max) : _clamp$1(snapDurClamp, snapDurClamp);
        snapDelayedCall = gsap$1.delayedCall(snap.delay || scrubSmooth / 2 || 0.1, function () {
          var scroll = scrollFunc(),
              refreshedRecently = _getTime$1() - lastRefresh < 500,
              tween = tweenTo.tween;

          if ((refreshedRecently || Math.abs(self.getVelocity()) < 10) && !tween && !_pointerIsDown && lastSnap !== scroll) {
            var progress = (scroll - start) / change,
                totalProgress = animation && !isToggle ? animation.totalProgress() : progress,
                velocity = refreshedRecently ? 0 : (totalProgress - snap2) / (_getTime$1() - _time2) * 1000 || 0,
                change1 = gsap$1.utils.clamp(-progress, 1 - progress, _abs(velocity / 2) * velocity / 0.185),
                naturalEnd = progress + (snap.inertia === false ? 0 : change1),
                endValue = _clamp$1(0, 1, snapFunc(naturalEnd, self)),
                endScroll = Math.round(start + endValue * change),
                _snap = snap,
                onStart = _snap.onStart,
                _onInterrupt = _snap.onInterrupt,
                _onComplete = _snap.onComplete;

            if (scroll <= end && scroll >= start && endScroll !== scroll) {
              if (tween && !tween._initted && tween.data <= _abs(endScroll - scroll)) {
                return;
              }

              if (snap.inertia === false) {
                change1 = endValue - progress;
              }

              tweenTo(endScroll, {
                duration: snapDurClamp(_abs(Math.max(_abs(naturalEnd - totalProgress), _abs(endValue - totalProgress)) * 0.185 / velocity / 0.05 || 0)),
                ease: snap.ease || "power3",
                data: _abs(endScroll - scroll),
                onInterrupt: function onInterrupt() {
                  return snapDelayedCall.restart(true) && _onInterrupt && _onInterrupt(self);
                },
                onComplete: function onComplete() {
                  self.update();
                  lastSnap = scrollFunc();
                  snap1 = snap2 = animation && !isToggle ? animation.totalProgress() : self.progress;
                  onSnapComplete && onSnapComplete(self);
                  _onComplete && _onComplete(self);
                }
              }, scroll, change1 * change, endScroll - scroll - change1 * change);
              onStart && onStart(self, tweenTo.tween);
            }
          } else if (self.isActive && lastSnap !== scroll) {
            snapDelayedCall.restart(true);
          }
        }).pause();
      }

      id && (_ids[id] = self);
      trigger = self.trigger = _getTarget(trigger || pin);
      customRevertReturn = trigger && trigger._gsap && trigger._gsap.stRevert;
      customRevertReturn && (customRevertReturn = customRevertReturn(self));
      pin = pin === true ? trigger : _getTarget(pin);
      _isString(toggleClass) && (toggleClass = {
        targets: trigger,
        className: toggleClass
      });

      if (pin) {
        pinSpacing === false || pinSpacing === _margin || (pinSpacing = !pinSpacing && pin.parentNode && pin.parentNode.style && _getComputedStyle(pin.parentNode).display === "flex" ? false : _padding);
        self.pin = pin;
        pinCache = gsap$1.core.getCache(pin);

        if (!pinCache.spacer) {
          if (pinSpacer) {
            pinSpacer = _getTarget(pinSpacer);
            pinSpacer && !pinSpacer.nodeType && (pinSpacer = pinSpacer.current || pinSpacer.nativeElement);
            pinCache.spacerIsNative = !!pinSpacer;
            pinSpacer && (pinCache.spacerState = _getState(pinSpacer));
          }

          pinCache.spacer = spacer = pinSpacer || _doc$1.createElement("div");
          spacer.classList.add("pin-spacer");
          id && spacer.classList.add("pin-spacer-" + id);
          pinCache.pinState = pinOriginalState = _getState(pin);
        } else {
          pinOriginalState = pinCache.pinState;
        }

        vars.force3D !== false && gsap$1.set(pin, {
          force3D: true
        });
        self.spacer = spacer = pinCache.spacer;
        cs = _getComputedStyle(pin);
        spacingStart = cs[pinSpacing + direction.os2];
        pinGetter = gsap$1.getProperty(pin);
        pinSetter = gsap$1.quickSetter(pin, direction.a, _px);

        _swapPinIn(pin, spacer, cs);

        pinState = _getState(pin);
      }

      if (markers) {
        markerVars = _isObject(markers) ? _setDefaults(markers, _markerDefaults) : _markerDefaults;
        markerStartTrigger = _createMarker("scroller-start", id, scroller, direction, markerVars, 0);
        markerEndTrigger = _createMarker("scroller-end", id, scroller, direction, markerVars, 0, markerStartTrigger);
        offset = markerStartTrigger["offset" + direction.op.d2];

        var content = _getTarget(_getProxyProp(scroller, "content") || scroller);

        markerStart = this.markerStart = _createMarker("start", id, content, direction, markerVars, offset, 0, containerAnimation);
        markerEnd = this.markerEnd = _createMarker("end", id, content, direction, markerVars, offset, 0, containerAnimation);
        containerAnimation && (caMarkerSetter = gsap$1.quickSetter([markerStart, markerEnd], direction.a, _px));

        if (!useFixedPosition && !(_proxies.length && _getProxyProp(scroller, "fixedMarkers") === true)) {
          _makePositionable(isViewport ? _body$1 : scroller);

          gsap$1.set([markerStartTrigger, markerEndTrigger], {
            force3D: true
          });
          markerStartSetter = gsap$1.quickSetter(markerStartTrigger, direction.a, _px);
          markerEndSetter = gsap$1.quickSetter(markerEndTrigger, direction.a, _px);
        }
      }

      if (containerAnimation) {
        var oldOnUpdate = containerAnimation.vars.onUpdate,
            oldParams = containerAnimation.vars.onUpdateParams;
        containerAnimation.eventCallback("onUpdate", function () {
          self.update(0, 0, 1);
          oldOnUpdate && oldOnUpdate.apply(oldParams || []);
        });
      }

      self.previous = function () {
        return _triggers[_triggers.indexOf(self) - 1];
      };

      self.next = function () {
        return _triggers[_triggers.indexOf(self) + 1];
      };

      self.revert = function (revert, temp) {
        if (!temp) {
          return self.kill(true);
        }

        var r = revert !== false || !self.enabled,
            prevRefreshing = _refreshing;

        if (r !== self.isReverted) {
          if (r) {
            prevScroll = Math.max(scrollFunc(), self.scroll.rec || 0);
            prevProgress = self.progress;
            prevAnimProgress = animation && animation.progress();
          }

          markerStart && [markerStart, markerEnd, markerStartTrigger, markerEndTrigger].forEach(function (m) {
            return m.style.display = r ? "none" : "block";
          });

          if (r) {
            _refreshing = 1;
            self.update(r);
          }

          if (pin) {
            if (r) {
              _swapPinOut(pin, spacer, pinOriginalState);
            } else {
              (!pinReparent || !self.isActive) && _swapPinIn(pin, spacer, _getComputedStyle(pin), spacerState);
            }
          }

          r || self.update(r);
          _refreshing = prevRefreshing;
          self.isReverted = r;
        }
      };

      self.refresh = function (soft, force) {
        if ((_refreshing || !self.enabled) && !force) {
          return;
        }

        if (pin && soft && _lastScrollTime) {
          _addListener$1(ScrollTrigger, "scrollEnd", _softRefresh);

          return;
        }

        !_refreshingAll && onRefreshInit && onRefreshInit(self);
        _refreshing = 1;
        lastRefresh = _getTime$1();

        if (tweenTo.tween) {
          tweenTo.tween.kill();
          tweenTo.tween = 0;
        }

        scrubTween && scrubTween.pause();
        invalidateOnRefresh && animation && animation.revert({
          kill: false
        }).invalidate();
        self.isReverted || self.revert(true, true);
        self._subPinOffset = false;

        var size = getScrollerSize(),
            scrollerBounds = getScrollerOffsets(),
            max = containerAnimation ? containerAnimation.duration() : _maxScroll(scroller, direction),
            offset = 0,
            otherPinOffset = 0,
            parsedEnd = vars.end,
            parsedEndTrigger = vars.endTrigger || trigger,
            parsedStart = vars.start || (vars.start === 0 || !trigger ? 0 : pin ? "0 0" : "0 100%"),
            pinnedContainer = self.pinnedContainer = vars.pinnedContainer && _getTarget(vars.pinnedContainer),
            triggerIndex = trigger && Math.max(0, _triggers.indexOf(self)) || 0,
            i = triggerIndex,
            cs,
            bounds,
            scroll,
            isVertical,
            override,
            curTrigger,
            curPin,
            oppositeScroll,
            initted,
            revertedPins;

        while (i--) {
          curTrigger = _triggers[i];
          curTrigger.end || curTrigger.refresh(0, 1) || (_refreshing = 1);
          curPin = curTrigger.pin;

          if (curPin && (curPin === trigger || curPin === pin) && !curTrigger.isReverted) {
            revertedPins || (revertedPins = []);
            revertedPins.unshift(curTrigger);
            curTrigger.revert(true, true);
          }

          if (curTrigger !== _triggers[i]) {
            triggerIndex--;
            i--;
          }
        }

        _isFunction(parsedStart) && (parsedStart = parsedStart(self));
        start = _parsePosition(parsedStart, trigger, size, direction, scrollFunc(), markerStart, markerStartTrigger, self, scrollerBounds, borderWidth, useFixedPosition, max, containerAnimation) || (pin ? -0.001 : 0);
        _isFunction(parsedEnd) && (parsedEnd = parsedEnd(self));

        if (_isString(parsedEnd) && !parsedEnd.indexOf("+=")) {
          if (~parsedEnd.indexOf(" ")) {
            parsedEnd = (_isString(parsedStart) ? parsedStart.split(" ")[0] : "") + parsedEnd;
          } else {
            offset = _offsetToPx(parsedEnd.substr(2), size);
            parsedEnd = _isString(parsedStart) ? parsedStart : start + offset;
            parsedEndTrigger = trigger;
          }
        }

        end = Math.max(start, _parsePosition(parsedEnd || (parsedEndTrigger ? "100% 0" : max), parsedEndTrigger, size, direction, scrollFunc() + offset, markerEnd, markerEndTrigger, self, scrollerBounds, borderWidth, useFixedPosition, max, containerAnimation)) || -0.001;
        change = end - start || (start -= 0.01) && 0.001;
        offset = 0;
        i = triggerIndex;

        while (i--) {
          curTrigger = _triggers[i];
          curPin = curTrigger.pin;

          if (curPin && curTrigger.start - curTrigger._pinPush <= start && !containerAnimation && curTrigger.end > 0) {
            cs = curTrigger.end - curTrigger.start;

            if ((curPin === trigger && curTrigger.start - curTrigger._pinPush < start || curPin === pinnedContainer) && !_isNumber(parsedStart)) {
              offset += cs * (1 - curTrigger.progress);
            }

            curPin === pin && (otherPinOffset += cs);
          }
        }

        start += offset;
        end += offset;
        self._pinPush = otherPinOffset;

        if (markerStart && offset) {
          cs = {};
          cs[direction.a] = "+=" + offset;
          pinnedContainer && (cs[direction.p] = "-=" + scrollFunc());
          gsap$1.set([markerStart, markerEnd], cs);
        }

        if (pin) {
          cs = _getComputedStyle(pin);
          isVertical = direction === _vertical;
          scroll = scrollFunc();
          pinStart = parseFloat(pinGetter(direction.a)) + otherPinOffset;
          !max && end > 1 && ((isViewport ? _body$1 : scroller).style["overflow-" + direction.a] = "scroll");

          _swapPinIn(pin, spacer, cs);

          pinState = _getState(pin);
          bounds = _getBounds(pin, true);
          oppositeScroll = useFixedPosition && _getScrollFunc(scroller, isVertical ? _horizontal : _vertical)();

          if (pinSpacing) {
            spacerState = [pinSpacing + direction.os2, change + otherPinOffset + _px];
            spacerState.t = spacer;
            i = pinSpacing === _padding ? _getSize(pin, direction) + change + otherPinOffset : 0;
            i && spacerState.push(direction.d, i + _px);

            _setState(spacerState);

            if (pinnedContainer) {
              _triggers.forEach(function (t) {
                if (t.pin === pinnedContainer && t.vars.pinSpacing !== false) {
                  t._subPinOffset = true;
                }
              });
            }

            useFixedPosition && scrollFunc(prevScroll);
          }

          if (useFixedPosition) {
            override = {
              top: bounds.top + (isVertical ? scroll - start : oppositeScroll) + _px,
              left: bounds.left + (isVertical ? oppositeScroll : scroll - start) + _px,
              boxSizing: "border-box",
              position: "fixed"
            };
            override[_width] = override["max" + _Width] = Math.ceil(bounds.width) + _px;
            override[_height] = override["max" + _Height] = Math.ceil(bounds.height) + _px;
            override[_margin] = override[_margin + _Top] = override[_margin + _Right] = override[_margin + _Bottom] = override[_margin + _Left] = "0";
            override[_padding] = cs[_padding];
            override[_padding + _Top] = cs[_padding + _Top];
            override[_padding + _Right] = cs[_padding + _Right];
            override[_padding + _Bottom] = cs[_padding + _Bottom];
            override[_padding + _Left] = cs[_padding + _Left];
            pinActiveState = _copyState(pinOriginalState, override, pinReparent);
            _refreshingAll && scrollFunc(0);
          }

          if (animation) {
            initted = animation._initted;

            _suppressOverwrites(1);

            animation.render(animation.duration(), true, true);
            pinChange = pinGetter(direction.a) - pinStart + change + otherPinOffset;
            change !== pinChange && useFixedPosition && pinActiveState.splice(pinActiveState.length - 2, 2);
            animation.render(0, true, true);
            initted || animation.invalidate(true);
            animation.parent || animation.totalTime(animation.totalTime());

            _suppressOverwrites(0);
          } else {
            pinChange = change;
          }
        } else if (trigger && scrollFunc() && !containerAnimation) {
          bounds = trigger.parentNode;

          while (bounds && bounds !== _body$1) {
            if (bounds._pinOffset) {
              start -= bounds._pinOffset;
              end -= bounds._pinOffset;
            }

            bounds = bounds.parentNode;
          }
        }

        revertedPins && revertedPins.forEach(function (t) {
          return t.revert(false, true);
        });
        self.start = start;
        self.end = end;
        scroll1 = scroll2 = _refreshingAll ? prevScroll : scrollFunc();

        if (!containerAnimation && !_refreshingAll) {
          scroll1 < prevScroll && scrollFunc(prevScroll);
          self.scroll.rec = 0;
        }

        self.revert(false, true);

        if (snapDelayedCall) {
          lastSnap = -1;
          self.isActive && scrollFunc(start + change * prevProgress);
          snapDelayedCall.restart(true);
        }

        _refreshing = 0;
        animation && isToggle && (animation._initted || prevAnimProgress) && animation.progress() !== prevAnimProgress && animation.progress(prevAnimProgress, true).render(animation.time(), true, true);

        if (prevProgress !== self.progress || containerAnimation) {
          animation && !isToggle && animation.totalProgress(prevProgress, true);
          self.progress = (scroll1 - start) / change === prevProgress ? 0 : prevProgress;
        }

        pin && pinSpacing && (spacer._pinOffset = Math.round(self.progress * pinChange));
        onRefresh && !_refreshingAll && onRefresh(self);
      };

      self.getVelocity = function () {
        return (scrollFunc() - scroll2) / (_getTime$1() - _time2) * 1000 || 0;
      };

      self.endAnimation = function () {
        _endAnimation(self.callbackAnimation);

        if (animation) {
          scrubTween ? scrubTween.progress(1) : !animation.paused() ? _endAnimation(animation, animation.reversed()) : isToggle || _endAnimation(animation, self.direction < 0, 1);
        }
      };

      self.labelToScroll = function (label) {
        return animation && animation.labels && (start || self.refresh() || start) + animation.labels[label] / animation.duration() * change || 0;
      };

      self.getTrailing = function (name) {
        var i = _triggers.indexOf(self),
            a = self.direction > 0 ? _triggers.slice(0, i).reverse() : _triggers.slice(i + 1);

        return (_isString(name) ? a.filter(function (t) {
          return t.vars.preventOverlaps === name;
        }) : a).filter(function (t) {
          return self.direction > 0 ? t.end <= start : t.start >= end;
        });
      };

      self.update = function (reset, recordVelocity, forceFake) {
        if (containerAnimation && !forceFake && !reset) {
          return;
        }

        var scroll = _refreshingAll ? prevScroll : self.scroll(),
            p = reset ? 0 : (scroll - start) / change,
            clipped = p < 0 ? 0 : p > 1 ? 1 : p || 0,
            prevProgress = self.progress,
            isActive,
            wasActive,
            toggleState,
            action,
            stateChanged,
            toggled,
            isAtMax,
            isTakingAction;

        if (recordVelocity) {
          scroll2 = scroll1;
          scroll1 = containerAnimation ? scrollFunc() : scroll;

          if (snap) {
            snap2 = snap1;
            snap1 = animation && !isToggle ? animation.totalProgress() : clipped;
          }
        }

        anticipatePin && !clipped && pin && !_refreshing && !_startup$1 && _lastScrollTime && start < scroll + (scroll - scroll2) / (_getTime$1() - _time2) * anticipatePin && (clipped = 0.0001);

        if (clipped !== prevProgress && self.enabled) {
          isActive = self.isActive = !!clipped && clipped < 1;
          wasActive = !!prevProgress && prevProgress < 1;
          toggled = isActive !== wasActive;
          stateChanged = toggled || !!clipped !== !!prevProgress;
          self.direction = clipped > prevProgress ? 1 : -1;
          self.progress = clipped;

          if (stateChanged && !_refreshing) {
            toggleState = clipped && !prevProgress ? 0 : clipped === 1 ? 1 : prevProgress === 1 ? 2 : 3;

            if (isToggle) {
              action = !toggled && toggleActions[toggleState + 1] !== "none" && toggleActions[toggleState + 1] || toggleActions[toggleState];
              isTakingAction = animation && (action === "complete" || action === "reset" || action in animation);
            }
          }

          preventOverlaps && (toggled || isTakingAction) && (isTakingAction || scrub || !animation) && (_isFunction(preventOverlaps) ? preventOverlaps(self) : self.getTrailing(preventOverlaps).forEach(function (t) {
            return t.endAnimation();
          }));

          if (!isToggle) {
            if (scrubTween && !_refreshing && !_startup$1) {
              (containerAnimation || _primary && _primary !== self) && scrubTween.render(scrubTween._dp._time - scrubTween._start);

              if (scrubTween.resetTo) {
                scrubTween.resetTo("totalProgress", clipped, animation._tTime / animation._tDur);
              } else {
                scrubTween.vars.totalProgress = clipped;
                scrubTween.invalidate().restart();
              }
            } else if (animation) {
              animation.totalProgress(clipped, !!_refreshing);
            }
          }

          if (pin) {
            reset && pinSpacing && (spacer.style[pinSpacing + direction.os2] = spacingStart);

            if (!useFixedPosition) {
              pinSetter(_round(pinStart + pinChange * clipped));
            } else if (stateChanged) {
              isAtMax = !reset && clipped > prevProgress && end + 1 > scroll && scroll + 1 >= _maxScroll(scroller, direction);

              if (pinReparent) {
                if (!reset && (isActive || isAtMax)) {
                  var bounds = _getBounds(pin, true),
                      _offset = scroll - start;

                  _reparent(pin, _body$1, bounds.top + (direction === _vertical ? _offset : 0) + _px, bounds.left + (direction === _vertical ? 0 : _offset) + _px);
                } else {
                  _reparent(pin, spacer);
                }
              }

              _setState(isActive || isAtMax ? pinActiveState : pinState);

              pinChange !== change && clipped < 1 && isActive || pinSetter(pinStart + (clipped === 1 && !isAtMax ? pinChange : 0));
            }
          }

          snap && !tweenTo.tween && !_refreshing && !_startup$1 && snapDelayedCall.restart(true);
          toggleClass && (toggled || once && clipped && (clipped < 1 || !_limitCallbacks)) && _toArray(toggleClass.targets).forEach(function (el) {
            return el.classList[isActive || once ? "add" : "remove"](toggleClass.className);
          });
          onUpdate && !isToggle && !reset && onUpdate(self);

          if (stateChanged && !_refreshing) {
            if (isToggle) {
              if (isTakingAction) {
                if (action === "complete") {
                  animation.pause().totalProgress(1);
                } else if (action === "reset") {
                  animation.restart(true).pause();
                } else if (action === "restart") {
                  animation.restart(true);
                } else {
                  animation[action]();
                }
              }

              onUpdate && onUpdate(self);
            }

            if (toggled || !_limitCallbacks) {
              onToggle && toggled && _callback(self, onToggle);
              callbacks[toggleState] && _callback(self, callbacks[toggleState]);
              once && (clipped === 1 ? self.kill(false, 1) : callbacks[toggleState] = 0);

              if (!toggled) {
                toggleState = clipped === 1 ? 1 : 3;
                callbacks[toggleState] && _callback(self, callbacks[toggleState]);
              }
            }

            if (fastScrollEnd && !isActive && Math.abs(self.getVelocity()) > (_isNumber(fastScrollEnd) ? fastScrollEnd : 2500)) {
              _endAnimation(self.callbackAnimation);

              scrubTween ? scrubTween.progress(1) : _endAnimation(animation, action === "reverse" ? 1 : !clipped, 1);
            }
          } else if (isToggle && onUpdate && !_refreshing) {
            onUpdate(self);
          }
        }

        if (markerEndSetter) {
          var n = containerAnimation ? scroll / containerAnimation.duration() * (containerAnimation._caScrollDist || 0) : scroll;
          markerStartSetter(n + (markerStartTrigger._isFlipped ? 1 : 0));
          markerEndSetter(n);
        }

        caMarkerSetter && caMarkerSetter(-scroll / containerAnimation.duration() * (containerAnimation._caScrollDist || 0));
      };

      self.enable = function (reset, refresh) {
        if (!self.enabled) {
          self.enabled = true;

          _addListener$1(scroller, "resize", _onResize);

          _addListener$1(isViewport ? _doc$1 : scroller, "scroll", _onScroll$1);

          onRefreshInit && _addListener$1(ScrollTrigger, "refreshInit", onRefreshInit);

          if (reset !== false) {
            self.progress = prevProgress = 0;
            scroll1 = scroll2 = lastSnap = scrollFunc();
          }

          refresh !== false && self.refresh();
        }
      };

      self.getTween = function (snap) {
        return snap && tweenTo ? tweenTo.tween : scrubTween;
      };

      self.setPositions = function (newStart, newEnd) {
        if (pin) {
          pinStart += newStart - start;
          pinChange += newEnd - newStart - change;
          pinSpacing === _padding && self.adjustPinSpacing(newEnd - newStart - change);
        }

        self.start = start = newStart;
        self.end = end = newEnd;
        change = newEnd - newStart;
        self.update();
      };

      self.adjustPinSpacing = function (amount) {
        if (spacerState) {
          var i = spacerState.indexOf(direction.d) + 1;
          spacerState[i] = parseFloat(spacerState[i]) + amount + _px;
          spacerState[1] = parseFloat(spacerState[1]) + amount + _px;

          _setState(spacerState);
        }
      };

      self.disable = function (reset, allowAnimation) {
        if (self.enabled) {
          reset !== false && self.revert(true, true);
          self.enabled = self.isActive = false;
          allowAnimation || scrubTween && scrubTween.pause();
          prevScroll = 0;
          pinCache && (pinCache.uncache = 1);
          onRefreshInit && _removeListener$1(ScrollTrigger, "refreshInit", onRefreshInit);

          if (snapDelayedCall) {
            snapDelayedCall.pause();
            tweenTo.tween && tweenTo.tween.kill() && (tweenTo.tween = 0);
          }

          if (!isViewport) {
            var i = _triggers.length;

            while (i--) {
              if (_triggers[i].scroller === scroller && _triggers[i] !== self) {
                return;
              }
            }

            _removeListener$1(scroller, "resize", _onResize);

            _removeListener$1(scroller, "scroll", _onScroll$1);
          }
        }
      };

      self.kill = function (revert, allowAnimation) {
        self.disable(revert, allowAnimation);
        scrubTween && !allowAnimation && scrubTween.kill();
        id && delete _ids[id];

        var i = _triggers.indexOf(self);

        i >= 0 && _triggers.splice(i, 1);
        i === _i && _direction > 0 && _i--;
        i = 0;

        _triggers.forEach(function (t) {
          return t.scroller === self.scroller && (i = 1);
        });

        i || _refreshingAll || (self.scroll.rec = 0);

        if (animation) {
          animation.scrollTrigger = null;
          revert && animation.revert({
            kill: false
          });
          allowAnimation || animation.kill();
        }

        markerStart && [markerStart, markerEnd, markerStartTrigger, markerEndTrigger].forEach(function (m) {
          return m.parentNode && m.parentNode.removeChild(m);
        });
        _primary === self && (_primary = 0);

        if (pin) {
          pinCache && (pinCache.uncache = 1);
          i = 0;

          _triggers.forEach(function (t) {
            return t.pin === pin && i++;
          });

          i || (pinCache.spacer = 0);
        }

        vars.onKill && vars.onKill(self);
      };

      self.enable(false, false);
      customRevertReturn && customRevertReturn(self);
      !animation || !animation.add || change ? self.refresh() : gsap$1.delayedCall(0.01, function () {
        return start || end || self.refresh();
      }) && (change = 0.01) && (start = end = 0);
      pin && _queueRefreshAll();
    };

    ScrollTrigger.register = function register(core) {
      if (!_coreInitted$1) {
        gsap$1 = core || _getGSAP$1();
        _windowExists() && window.document && ScrollTrigger.enable();
        _coreInitted$1 = _enabled;
      }

      return _coreInitted$1;
    };

    ScrollTrigger.defaults = function defaults(config) {
      if (config) {
        for (var p in config) {
          _defaults[p] = config[p];
        }
      }

      return _defaults;
    };

    ScrollTrigger.disable = function disable(reset, kill) {
      _enabled = 0;

      _triggers.forEach(function (trigger) {
        return trigger[kill ? "kill" : "disable"](reset);
      });

      _removeListener$1(_win$1, "wheel", _onScroll$1);

      _removeListener$1(_doc$1, "scroll", _onScroll$1);

      clearInterval(_syncInterval);

      _removeListener$1(_doc$1, "touchcancel", _passThrough);

      _removeListener$1(_body$1, "touchstart", _passThrough);

      _multiListener(_removeListener$1, _doc$1, "pointerdown,touchstart,mousedown", _pointerDownHandler);

      _multiListener(_removeListener$1, _doc$1, "pointerup,touchend,mouseup", _pointerUpHandler);

      _resizeDelay.kill();

      _iterateAutoRefresh(_removeListener$1);

      for (var i = 0; i < _scrollers.length; i += 3) {
        _wheelListener(_removeListener$1, _scrollers[i], _scrollers[i + 1]);

        _wheelListener(_removeListener$1, _scrollers[i], _scrollers[i + 2]);
      }
    };

    ScrollTrigger.enable = function enable() {
      _win$1 = window;
      _doc$1 = document;
      _docEl$1 = _doc$1.documentElement;
      _body$1 = _doc$1.body;

      if (gsap$1) {
        _toArray = gsap$1.utils.toArray;
        _clamp$1 = gsap$1.utils.clamp;
        _context = gsap$1.core.context || _passThrough;
        _suppressOverwrites = gsap$1.core.suppressOverwrites || _passThrough;
        _scrollRestoration = _win$1.history.scrollRestoration || "auto";
        gsap$1.core.globals("ScrollTrigger", ScrollTrigger);

        if (_body$1) {
          _enabled = 1;
          Observer.register(gsap$1);
          ScrollTrigger.isTouch = Observer.isTouch;
          _fixIOSBug = Observer.isTouch && /(iPad|iPhone|iPod|Mac)/g.test(navigator.userAgent);

          _addListener$1(_win$1, "wheel", _onScroll$1);

          _root$1 = [_win$1, _doc$1, _docEl$1, _body$1];

          if (gsap$1.matchMedia) {
            ScrollTrigger.matchMedia = function (vars) {
              var mm = gsap$1.matchMedia(),
                  p;

              for (p in vars) {
                mm.add(p, vars[p]);
              }

              return mm;
            };

            gsap$1.addEventListener("matchMediaInit", function () {
              return _revertAll();
            });
            gsap$1.addEventListener("matchMediaRevert", function () {
              return _revertRecorded();
            });
            gsap$1.addEventListener("matchMedia", function () {
              _refreshAll(0, 1);

              _dispatch("matchMedia");
            });
            gsap$1.matchMedia("(orientation: portrait)", function () {
              _setBaseDimensions();

              return _setBaseDimensions;
            });
          } else {
            console.warn("Requires GSAP 3.11.0 or later");
          }

          _setBaseDimensions();

          _addListener$1(_doc$1, "scroll", _onScroll$1);

          var bodyStyle = _body$1.style,
              border = bodyStyle.borderTopStyle,
              AnimationProto = gsap$1.core.Animation.prototype,
              bounds,
              i;
          AnimationProto.revert || Object.defineProperty(AnimationProto, "revert", {
            value: function value() {
              return this.time(-0.01, true);
            }
          });
          bodyStyle.borderTopStyle = "solid";
          bounds = _getBounds(_body$1);
          _vertical.m = Math.round(bounds.top + _vertical.sc()) || 0;
          _horizontal.m = Math.round(bounds.left + _horizontal.sc()) || 0;
          border ? bodyStyle.borderTopStyle = border : bodyStyle.removeProperty("border-top-style");
          _syncInterval = setInterval(_sync, 250);
          gsap$1.delayedCall(0.5, function () {
            return _startup$1 = 0;
          });

          _addListener$1(_doc$1, "touchcancel", _passThrough);

          _addListener$1(_body$1, "touchstart", _passThrough);

          _multiListener(_addListener$1, _doc$1, "pointerdown,touchstart,mousedown", _pointerDownHandler);

          _multiListener(_addListener$1, _doc$1, "pointerup,touchend,mouseup", _pointerUpHandler);

          _transformProp = gsap$1.utils.checkPrefix("transform");

          _stateProps.push(_transformProp);

          _coreInitted$1 = _getTime$1();
          _resizeDelay = gsap$1.delayedCall(0.2, _refreshAll).pause();
          _autoRefresh = [_doc$1, "visibilitychange", function () {
            var w = _win$1.innerWidth,
                h = _win$1.innerHeight;

            if (_doc$1.hidden) {
              _prevWidth = w;
              _prevHeight = h;
            } else if (_prevWidth !== w || _prevHeight !== h) {
              _onResize();
            }
          }, _doc$1, "DOMContentLoaded", _refreshAll, _win$1, "load", _refreshAll, _win$1, "resize", _onResize];

          _iterateAutoRefresh(_addListener$1);

          _triggers.forEach(function (trigger) {
            return trigger.enable(0, 1);
          });

          for (i = 0; i < _scrollers.length; i += 3) {
            _wheelListener(_removeListener$1, _scrollers[i], _scrollers[i + 1]);

            _wheelListener(_removeListener$1, _scrollers[i], _scrollers[i + 2]);
          }
        }
      }
    };

    ScrollTrigger.config = function config(vars) {
      "limitCallbacks" in vars && (_limitCallbacks = !!vars.limitCallbacks);
      var ms = vars.syncInterval;
      ms && clearInterval(_syncInterval) || (_syncInterval = ms) && setInterval(_sync, ms);
      "ignoreMobileResize" in vars && (_ignoreMobileResize = ScrollTrigger.isTouch === 1 && vars.ignoreMobileResize);

      if ("autoRefreshEvents" in vars) {
        _iterateAutoRefresh(_removeListener$1) || _iterateAutoRefresh(_addListener$1, vars.autoRefreshEvents || "none");
        _ignoreResize = (vars.autoRefreshEvents + "").indexOf("resize") === -1;
      }
    };

    ScrollTrigger.scrollerProxy = function scrollerProxy(target, vars) {
      var t = _getTarget(target),
          i = _scrollers.indexOf(t),
          isViewport = _isViewport$1(t);

      if (~i) {
        _scrollers.splice(i, isViewport ? 6 : 2);
      }

      if (vars) {
        isViewport ? _proxies.unshift(_win$1, vars, _body$1, vars, _docEl$1, vars) : _proxies.unshift(t, vars);
      }
    };

    ScrollTrigger.clearMatchMedia = function clearMatchMedia(query) {
      _triggers.forEach(function (t) {
        return t._ctx && t._ctx.query === query && t._ctx.kill(true, true);
      });
    };

    ScrollTrigger.isInViewport = function isInViewport(element, ratio, horizontal) {
      var bounds = (_isString(element) ? _getTarget(element) : element).getBoundingClientRect(),
          offset = bounds[horizontal ? _width : _height] * ratio || 0;
      return horizontal ? bounds.right - offset > 0 && bounds.left + offset < _win$1.innerWidth : bounds.bottom - offset > 0 && bounds.top + offset < _win$1.innerHeight;
    };

    ScrollTrigger.positionInViewport = function positionInViewport(element, referencePoint, horizontal) {
      _isString(element) && (element = _getTarget(element));
      var bounds = element.getBoundingClientRect(),
          size = bounds[horizontal ? _width : _height],
          offset = referencePoint == null ? size / 2 : referencePoint in _keywords ? _keywords[referencePoint] * size : ~referencePoint.indexOf("%") ? parseFloat(referencePoint) * size / 100 : parseFloat(referencePoint) || 0;
      return horizontal ? (bounds.left + offset) / _win$1.innerWidth : (bounds.top + offset) / _win$1.innerHeight;
    };

    ScrollTrigger.killAll = function killAll(allowListeners) {
      _triggers.forEach(function (t) {
        return t.vars.id !== "ScrollSmoother" && t.kill();
      });

      if (allowListeners !== true) {
        var listeners = _listeners.killAll || [];
        _listeners = {};
        listeners.forEach(function (f) {
          return f();
        });
      }
    };

    return ScrollTrigger;
  }();
  ScrollTrigger$1.version = "3.11.3";

  ScrollTrigger$1.saveStyles = function (targets) {
    return targets ? _toArray(targets).forEach(function (target) {
      if (target && target.style) {
        var i = _savedStyles.indexOf(target);

        i >= 0 && _savedStyles.splice(i, 5);

        _savedStyles.push(target, target.style.cssText, target.getBBox && target.getAttribute("transform"), gsap$1.core.getCache(target), _context());
      }
    }) : _savedStyles;
  };

  ScrollTrigger$1.revert = function (soft, media) {
    return _revertAll(!soft, media);
  };

  ScrollTrigger$1.create = function (vars, animation) {
    return new ScrollTrigger$1(vars, animation);
  };

  ScrollTrigger$1.refresh = function (safe) {
    return safe ? _onResize() : (_coreInitted$1 || ScrollTrigger$1.register()) && _refreshAll(true);
  };

  ScrollTrigger$1.update = _updateAll;
  ScrollTrigger$1.clearScrollMemory = _clearScrollMemory;

  ScrollTrigger$1.maxScroll = function (element, horizontal) {
    return _maxScroll(element, horizontal ? _horizontal : _vertical);
  };

  ScrollTrigger$1.getScrollFunc = function (element, horizontal) {
    return _getScrollFunc(_getTarget(element), horizontal ? _horizontal : _vertical);
  };

  ScrollTrigger$1.getById = function (id) {
    return _ids[id];
  };

  ScrollTrigger$1.getAll = function () {
    return _triggers.filter(function (t) {
      return t.vars.id !== "ScrollSmoother";
    });
  };

  ScrollTrigger$1.isScrolling = function () {
    return !!_lastScrollTime;
  };

  ScrollTrigger$1.snapDirectional = _snapDirectional;

  ScrollTrigger$1.addEventListener = function (type, callback) {
    var a = _listeners[type] || (_listeners[type] = []);
    ~a.indexOf(callback) || a.push(callback);
  };

  ScrollTrigger$1.removeEventListener = function (type, callback) {
    var a = _listeners[type],
        i = a && a.indexOf(callback);
    i >= 0 && a.splice(i, 1);
  };

  ScrollTrigger$1.batch = function (targets, vars) {
    var result = [],
        varsCopy = {},
        interval = vars.interval || 0.016,
        batchMax = vars.batchMax || 1e9,
        proxyCallback = function proxyCallback(type, callback) {
      var elements = [],
          triggers = [],
          delay = gsap$1.delayedCall(interval, function () {
        callback(elements, triggers);
        elements = [];
        triggers = [];
      }).pause();
      return function (self) {
        elements.length || delay.restart(true);
        elements.push(self.trigger);
        triggers.push(self);
        batchMax <= elements.length && delay.progress(1);
      };
    },
        p;

    for (p in vars) {
      varsCopy[p] = p.substr(0, 2) === "on" && _isFunction(vars[p]) && p !== "onRefreshInit" ? proxyCallback(p, vars[p]) : vars[p];
    }

    if (_isFunction(batchMax)) {
      batchMax = batchMax();

      _addListener$1(ScrollTrigger$1, "refresh", function () {
        return batchMax = vars.batchMax();
      });
    }

    _toArray(targets).forEach(function (target) {
      var config = {};

      for (p in varsCopy) {
        config[p] = varsCopy[p];
      }

      config.trigger = target;
      result.push(ScrollTrigger$1.create(config));
    });

    return result;
  };

  var _clampScrollAndGetDurationMultiplier = function _clampScrollAndGetDurationMultiplier(scrollFunc, current, end, max) {
    current > max ? scrollFunc(max) : current < 0 && scrollFunc(0);
    return end > max ? (max - current) / (end - current) : end < 0 ? current / (current - end) : 1;
  },
      _allowNativePanning = function _allowNativePanning(target, direction) {
    if (direction === true) {
      target.style.removeProperty("touch-action");
    } else {
      target.style.touchAction = direction === true ? "auto" : direction ? "pan-" + direction + (Observer.isTouch ? " pinch-zoom" : "") : "none";
    }

    target === _docEl$1 && _allowNativePanning(_body$1, direction);
  },
      _overflow = {
    auto: 1,
    scroll: 1
  },
      _nestedScroll = function _nestedScroll(_ref5) {
    var event = _ref5.event,
        target = _ref5.target,
        axis = _ref5.axis;

    var node = (event.changedTouches ? event.changedTouches[0] : event).target,
        cache = node._gsap || gsap$1.core.getCache(node),
        time = _getTime$1(),
        cs;

    if (!cache._isScrollT || time - cache._isScrollT > 2000) {
      while (node && node.scrollHeight <= node.clientHeight) {
        node = node.parentNode;
      }

      cache._isScroll = node && !_isViewport$1(node) && node !== target && (_overflow[(cs = _getComputedStyle(node)).overflowY] || _overflow[cs.overflowX]);
      cache._isScrollT = time;
    }

    if (cache._isScroll || axis === "x") {
      event.stopPropagation();
      event._gsapAllow = true;
    }
  },
      _inputObserver = function _inputObserver(target, type, inputs, nested) {
    return Observer.create({
      target: target,
      capture: true,
      debounce: false,
      lockAxis: true,
      type: type,
      onWheel: nested = nested && _nestedScroll,
      onPress: nested,
      onDrag: nested,
      onScroll: nested,
      onEnable: function onEnable() {
        return inputs && _addListener$1(_doc$1, Observer.eventTypes[0], _captureInputs, false, true);
      },
      onDisable: function onDisable() {
        return _removeListener$1(_doc$1, Observer.eventTypes[0], _captureInputs, true);
      }
    });
  },
      _inputExp = /(input|label|select|textarea)/i,
      _inputIsFocused,
      _captureInputs = function _captureInputs(e) {
    var isInput = _inputExp.test(e.target.tagName);

    if (isInput || _inputIsFocused) {
      e._gsapAllow = true;
      _inputIsFocused = isInput;
    }
  },
      _getScrollNormalizer = function _getScrollNormalizer(vars) {
    _isObject(vars) || (vars = {});
    vars.preventDefault = vars.isNormalizer = vars.allowClicks = true;
    vars.type || (vars.type = "wheel,touch");
    vars.debounce = !!vars.debounce;
    vars.id = vars.id || "normalizer";

    var _vars2 = vars,
        normalizeScrollX = _vars2.normalizeScrollX,
        momentum = _vars2.momentum,
        allowNestedScroll = _vars2.allowNestedScroll,
        self,
        maxY,
        target = _getTarget(vars.target) || _docEl$1,
        smoother = gsap$1.core.globals().ScrollSmoother,
        smootherInstance = smoother && smoother.get(),
        content = _fixIOSBug && (vars.content && _getTarget(vars.content) || smootherInstance && vars.content !== false && !smootherInstance.smooth() && smootherInstance.content()),
        scrollFuncY = _getScrollFunc(target, _vertical),
        scrollFuncX = _getScrollFunc(target, _horizontal),
        scale = 1,
        initialScale = (Observer.isTouch && _win$1.visualViewport ? _win$1.visualViewport.scale * _win$1.visualViewport.width : _win$1.outerWidth) / _win$1.innerWidth,
        wheelRefresh = 0,
        resolveMomentumDuration = _isFunction(momentum) ? function () {
      return momentum(self);
    } : function () {
      return momentum || 2.8;
    },
        lastRefreshID,
        skipTouchMove,
        inputObserver = _inputObserver(target, vars.type, true, allowNestedScroll),
        resumeTouchMove = function resumeTouchMove() {
      return skipTouchMove = false;
    },
        scrollClampX = _passThrough,
        scrollClampY = _passThrough,
        updateClamps = function updateClamps() {
      maxY = _maxScroll(target, _vertical);
      scrollClampY = _clamp$1(_fixIOSBug ? 1 : 0, maxY);
      normalizeScrollX && (scrollClampX = _clamp$1(0, _maxScroll(target, _horizontal)));
      lastRefreshID = _refreshID;
    },
        removeContentOffset = function removeContentOffset() {
      content._gsap.y = _round(parseFloat(content._gsap.y) + scrollFuncY.offset) + "px";
      content.style.transform = "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, " + parseFloat(content._gsap.y) + ", 0, 1)";
      scrollFuncY.offset = scrollFuncY.cacheID = 0;
    },
        ignoreDrag = function ignoreDrag() {
      if (skipTouchMove) {
        requestAnimationFrame(resumeTouchMove);

        var offset = _round(self.deltaY / 2),
            scroll = scrollClampY(scrollFuncY.v - offset);

        if (content && scroll !== scrollFuncY.v + scrollFuncY.offset) {
          scrollFuncY.offset = scroll - scrollFuncY.v;

          var y = _round((parseFloat(content && content._gsap.y) || 0) - scrollFuncY.offset);

          content.style.transform = "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, " + y + ", 0, 1)";
          content._gsap.y = y + "px";
          scrollFuncY.cacheID = _scrollers.cache;

          _updateAll();
        }

        return true;
      }

      scrollFuncY.offset && removeContentOffset();
      skipTouchMove = true;
    },
        tween,
        startScrollX,
        startScrollY,
        onStopDelayedCall,
        onResize = function onResize() {
      updateClamps();

      if (tween.isActive() && tween.vars.scrollY > maxY) {
        scrollFuncY() > maxY ? tween.progress(1) && scrollFuncY(maxY) : tween.resetTo("scrollY", maxY);
      }
    };

    content && gsap$1.set(content, {
      y: "+=0"
    });

    vars.ignoreCheck = function (e) {
      return _fixIOSBug && e.type === "touchmove" && ignoreDrag() || scale > 1.05 && e.type !== "touchstart" || self.isGesturing || e.touches && e.touches.length > 1;
    };

    vars.onPress = function () {
      var prevScale = scale;
      scale = _round((_win$1.visualViewport && _win$1.visualViewport.scale || 1) / initialScale);
      tween.pause();
      prevScale !== scale && _allowNativePanning(target, scale > 1.01 ? true : normalizeScrollX ? false : "x");
      startScrollX = scrollFuncX();
      startScrollY = scrollFuncY();
      updateClamps();
      lastRefreshID = _refreshID;
    };

    vars.onRelease = vars.onGestureStart = function (self, wasDragging) {
      scrollFuncY.offset && removeContentOffset();

      if (!wasDragging) {
        onStopDelayedCall.restart(true);
      } else {
        _scrollers.cache++;
        var dur = resolveMomentumDuration(),
            currentScroll,
            endScroll;

        if (normalizeScrollX) {
          currentScroll = scrollFuncX();
          endScroll = currentScroll + dur * 0.05 * -self.velocityX / 0.227;
          dur *= _clampScrollAndGetDurationMultiplier(scrollFuncX, currentScroll, endScroll, _maxScroll(target, _horizontal));
          tween.vars.scrollX = scrollClampX(endScroll);
        }

        currentScroll = scrollFuncY();
        endScroll = currentScroll + dur * 0.05 * -self.velocityY / 0.227;
        dur *= _clampScrollAndGetDurationMultiplier(scrollFuncY, currentScroll, endScroll, _maxScroll(target, _vertical));
        tween.vars.scrollY = scrollClampY(endScroll);
        tween.invalidate().duration(dur).play(0.01);

        if (_fixIOSBug && tween.vars.scrollY >= maxY || currentScroll >= maxY - 1) {
          gsap$1.to({}, {
            onUpdate: onResize,
            duration: dur
          });
        }
      }
    };

    vars.onWheel = function () {
      tween._ts && tween.pause();

      if (_getTime$1() - wheelRefresh > 1000) {
        lastRefreshID = 0;
        wheelRefresh = _getTime$1();
      }
    };

    vars.onChange = function (self, dx, dy, xArray, yArray) {
      _refreshID !== lastRefreshID && updateClamps();
      dx && normalizeScrollX && scrollFuncX(scrollClampX(xArray[2] === dx ? startScrollX + (self.startX - self.x) : scrollFuncX() + dx - xArray[1]));

      if (dy) {
        scrollFuncY.offset && removeContentOffset();
        var isTouch = yArray[2] === dy,
            y = isTouch ? startScrollY + self.startY - self.y : scrollFuncY() + dy - yArray[1],
            yClamped = scrollClampY(y);
        isTouch && y !== yClamped && (startScrollY += yClamped - y);
        scrollFuncY(yClamped);
      }

      (dy || dx) && _updateAll();
    };

    vars.onEnable = function () {
      _allowNativePanning(target, normalizeScrollX ? false : "x");

      ScrollTrigger$1.addEventListener("refresh", onResize);

      _addListener$1(_win$1, "resize", onResize);

      if (scrollFuncY.smooth) {
        scrollFuncY.target.style.scrollBehavior = "auto";
        scrollFuncY.smooth = scrollFuncX.smooth = false;
      }

      inputObserver.enable();
    };

    vars.onDisable = function () {
      _allowNativePanning(target, true);

      _removeListener$1(_win$1, "resize", onResize);

      ScrollTrigger$1.removeEventListener("refresh", onResize);
      inputObserver.kill();
    };

    vars.lockAxis = vars.lockAxis !== false;
    self = new Observer(vars);
    self.iOS = _fixIOSBug;
    _fixIOSBug && !scrollFuncY() && scrollFuncY(1);
    _fixIOSBug && gsap$1.ticker.add(_passThrough);
    onStopDelayedCall = self._dc;
    tween = gsap$1.to(self, {
      ease: "power4",
      paused: true,
      scrollX: normalizeScrollX ? "+=0.1" : "+=0",
      scrollY: "+=0.1",
      onComplete: onStopDelayedCall.vars.onComplete
    });
    return self;
  };

  ScrollTrigger$1.sort = function (func) {
    return _triggers.sort(func || function (a, b) {
      return (a.vars.refreshPriority || 0) * -1e6 + a.start - (b.start + (b.vars.refreshPriority || 0) * -1e6);
    });
  };

  ScrollTrigger$1.observe = function (vars) {
    return new Observer(vars);
  };

  ScrollTrigger$1.normalizeScroll = function (vars) {
    if (typeof vars === "undefined") {
      return _normalizer$1;
    }

    if (vars === true && _normalizer$1) {
      return _normalizer$1.enable();
    }

    if (vars === false) {
      return _normalizer$1 && _normalizer$1.kill();
    }

    var normalizer = vars instanceof Observer ? vars : _getScrollNormalizer(vars);
    _normalizer$1 && _normalizer$1.target === normalizer.target && _normalizer$1.kill();
    _isViewport$1(normalizer.target) && (_normalizer$1 = normalizer);
    return normalizer;
  };

  ScrollTrigger$1.core = {
    _getVelocityProp: _getVelocityProp,
    _inputObserver: _inputObserver,
    _scrollers: _scrollers,
    _proxies: _proxies,
    bridge: {
      ss: function ss() {
        _lastScrollTime || _dispatch("scrollStart");
        _lastScrollTime = _getTime$1();
      },
      ref: function ref() {
        return _refreshing;
      }
    }
  };
  _getGSAP$1() && gsap$1.registerPlugin(ScrollTrigger$1);

  exports.ScrollTrigger = ScrollTrigger$1;
  exports.default = ScrollTrigger$1;

  if (typeof(window) === 'undefined' || window !== exports) {Object.defineProperty(exports, '__esModule', { value: true });} else {delete window.default;}

})));

/*!
 * SplitText 3.12.2
 * https://greensock.com
 *
 * @license Copyright 2023, GreenSock. All rights reserved.
 * This plugin is a membership benefit of Club GreenSock and is only authorized for use in sites/apps/products developed by individuals/companies with an active Club GreenSock membership. See https://greensock.com/club
 * @author: Jack Doyle, jack@greensock.com
 */

!(function (D, u) {
  "object" == typeof exports && "undefined" != typeof module ? u(exports)
  : "function" == typeof define && define.amd ? define(["exports"], u)
  : u(((D = D || self).window = D.window || {}));
})(this, function (D) {
  "use strict";
  var _ =
    /([\uD800-\uDBFF][\uDC00-\uDFFF](?:[\u200D\uFE0F][\uD800-\uDBFF][\uDC00-\uDFFF]){2,}|\uD83D\uDC69(?:\u200D(?:(?:\uD83D\uDC69\u200D)?\uD83D\uDC67|(?:\uD83D\uDC69\u200D)?\uD83D\uDC66)|\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC69\u200D(?:\uD83D\uDC69\u200D)?\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D(?:\uD83D\uDC69\u200D)?\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]\uFE0F|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC6F\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3C-\uDD3E\uDDD6-\uDDDF])\u200D[\u2640\u2642]\uFE0F|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF6\uD83C\uDDE6|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F\u200D[\u2640\u2642]|(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642])\uFE0F|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2695\u2696\u2708]|\uD83D\uDC69\u200D[\u2695\u2696\u2708]|\uD83D\uDC68(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708]))\uFE0F|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83D\uDC69\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69]))|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67)\uDB40\uDC7F|\uD83D\uDC68(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC66\u200D\uD83D\uDC66|(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92])|(?:\uD83C[\uDFFB-\uDFFF])\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]))|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDD1-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\u200D(?:(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC67|(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC66)|\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC69\uDC6E\uDC70-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD18-\uDD1C\uDD1E\uDD1F\uDD26\uDD30-\uDD39\uDD3D\uDD3E\uDDD1-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])?|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDEEB\uDEEC\uDEF4-\uDEF8]|\uD83E[\uDD10-\uDD3A\uDD3C-\uDD3E\uDD40-\uDD45\uDD47-\uDD4C\uDD50-\uDD6B\uDD80-\uDD97\uDDC0\uDDD0-\uDDE6])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u2660\u2663\u2665\u2666\u2668\u267B\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEF8]|\uD83E[\uDD10-\uDD3A\uDD3C-\uDD3E\uDD40-\uDD45\uDD47-\uDD4C\uDD50-\uDD6B\uDD80-\uDD97\uDDC0\uDDD0-\uDDE6])\uFE0F)/;
  function m(D) {
    ((X = document), (e = window), (C = C || D || e.gsap || console.warn("Please gsap.registerPlugin(SplitText)")) && ((l = C.utils.toArray), (i = C.core.context || function () {}), (F = 1)));
  }
  function n(D) {
    return e.getComputedStyle(D);
  }
  function o(D) {
    return "absolute" === D.position || !0 === D.absolute;
  }
  function p(D, u) {
    for (var e, t = u.length; -1 < --t; ) if (((e = u[t]), D.substr(0, e.length) === e)) return e.length;
  }
  function r(D, u) {
    void 0 === D && (D = "");
    var e = ~D.indexOf("++"),
      t = 1;
    return (
      e && (D = D.split("++").join("")),
      function () {
        return "<" + u + " style='position:relative;display:inline-block;'" + (D ? " class='" + D + (e ? t++ : "") + "'>" : ">");
      }
    );
  }
  function s(D, u, e) {
    var t = D.nodeType;
    if (1 === t || 9 === t || 11 === t) for (D = D.firstChild; D; D = D.nextSibling) s(D, u, e);
    else (3 !== t && 4 !== t) || (D.nodeValue = D.nodeValue.split(u).join(e));
  }
  function t(D, u) {
    for (var e = u.length; -1 < --e; ) D.push(u[e]);
  }
  function u(D, u, e) {
    for (var t; D && D !== u; ) {
      if ((t = D._next || D.nextSibling)) return t.textContent.charAt(0) === e;
      D = D.parentNode || D._parent;
    }
  }
  function v(D) {
    var u,
      e,
      t = l(D.childNodes),
      F = t.length;
    for (u = 0; u < F; u++)
      (e = t[u])._isSplit ? v(e)
      : u && e.previousSibling && 3 === e.previousSibling.nodeType ? ((e.previousSibling.nodeValue += 3 === e.nodeType ? e.nodeValue : e.firstChild.nodeValue), D.removeChild(e))
      : 3 !== e.nodeType && (D.insertBefore(e.firstChild, e), D.removeChild(e));
  }
  function w(D, u) {
    return parseFloat(u[D]) || 0;
  }
  function x(D, e, F, C, i, E, r) {
    var l,
      p,
      d,
      a,
      h,
      B,
      f,
      A,
      c,
      x,
      g,
      y,
      _ = n(D),
      b = w("paddingLeft", _),
      S = -999,
      T = w("borderBottomWidth", _) + w("borderTopWidth", _),
      m = w("borderLeftWidth", _) + w("borderRightWidth", _),
      N = w("paddingTop", _) + w("paddingBottom", _),
      L = w("paddingLeft", _) + w("paddingRight", _),
      W = w("fontSize", _) * (e.lineThreshold || 0.2),
      H = _.textAlign,
      O = [],
      V = [],
      M = [],
      R = e.wordDelimiter || " ",
      j =
        e.tag ? e.tag
        : e.span ? "span"
        : "div",
      k = e.type || e.split || "chars,words,lines",
      P = i && ~k.indexOf("lines") ? [] : null,
      z = ~k.indexOf("words"),
      q = ~k.indexOf("chars"),
      G = o(e),
      I = e.linesClass,
      J = ~(I || "").indexOf("++"),
      K = [],
      Q = "flex" === _.display,
      U = D.style.display;
    for (J && (I = I.split("++").join("")), Q && (D.style.display = "block"), d = (p = D.getElementsByTagName("*")).length, h = [], l = 0; l < d; l++) h[l] = p[l];
    if (P || G) for (l = 0; l < d; l++) ((B = (a = h[l]).parentNode === D) || G || (q && !z)) && ((y = a.offsetTop), P && B && Math.abs(y - S) > W && ("BR" !== a.nodeName || 0 === l) && ((f = []), P.push(f), (S = y)), G && ((a._x = a.offsetLeft), (a._y = y), (a._w = a.offsetWidth), (a._h = a.offsetHeight)), P && (((a._isSplit && B) || (!q && B) || (z && B) || (!z && a.parentNode.parentNode === D && !a.parentNode._isSplit)) && (f.push(a), (a._x -= b), u(a, D, R) && (a._wordEnd = !0)), "BR" === a.nodeName && ((a.nextSibling && "BR" === a.nextSibling.nodeName) || 0 === l) && P.push([])));
    for (l = 0; l < d; l++)
      if (((B = (a = h[l]).parentNode === D), "BR" !== a.nodeName))
        if ((G && ((c = a.style), z || B || ((a._x += a.parentNode._x), (a._y += a.parentNode._y)), (c.left = a._x + "px"), (c.top = a._y + "px"), (c.position = "absolute"), (c.display = "block"), (c.width = a._w + 1 + "px"), (c.height = a._h + "px")), !z && q))
          if (a._isSplit) for (a._next = p = a.nextSibling, a.parentNode.appendChild(a); p && 3 === p.nodeType && " " === p.textContent; ) ((a._next = p.nextSibling), a.parentNode.appendChild(p), (p = p.nextSibling));
          else a.parentNode._isSplit ? ((a._parent = a.parentNode), !a.previousSibling && a.firstChild && (a.firstChild._isFirst = !0), a.nextSibling && " " === a.nextSibling.textContent && !a.nextSibling.nextSibling && K.push(a.nextSibling), (a._next = a.nextSibling && a.nextSibling._isFirst ? null : a.nextSibling), a.parentNode.removeChild(a), h.splice(l--, 1), d--) : B || ((y = !a.nextSibling && u(a.parentNode, D, R)), a.parentNode._parent && a.parentNode._parent.appendChild(a), y && a.parentNode.appendChild(X.createTextNode(" ")), "span" === j && (a.style.display = "inline"), O.push(a));
        else a.parentNode._isSplit && !a._isSplit && "" !== a.innerHTML ? V.push(a) : q && !a._isSplit && ("span" === j && (a.style.display = "inline"), O.push(a));
      else P || G ? (a.parentNode && a.parentNode.removeChild(a), h.splice(l--, 1), d--) : z || D.appendChild(a);
    for (l = K.length; -1 < --l; ) K[l].parentNode.removeChild(K[l]);
    if (P) {
      for (G && ((x = X.createElement(j)), D.appendChild(x), (g = x.offsetWidth + "px"), (y = x.offsetParent === D ? 0 : D.offsetLeft), D.removeChild(x)), c = D.style.cssText, D.style.cssText = "display:none;"; D.firstChild; ) D.removeChild(D.firstChild);
      for (A = " " === R && (!G || (!z && !q)), l = 0; l < P.length; l++) {
        for (f = P[l], (x = X.createElement(j)).style.cssText = "display:block;text-align:" + H + ";position:" + (G ? "absolute;" : "relative;"), I && (x.className = I + (J ? l + 1 : "")), M.push(x), d = f.length, p = 0; p < d; p++) "BR" !== f[p].nodeName && ((a = f[p]), x.appendChild(a), A && a._wordEnd && x.appendChild(X.createTextNode(" ")), G && (0 === p && ((x.style.top = a._y + "px"), (x.style.left = b + y + "px")), (a.style.top = "0px"), y && (a.style.left = a._x - y + "px")));
        (0 === d ? (x.innerHTML = "&nbsp;") : z || q || (v(x), s(x, String.fromCharCode(160), " ")), G && ((x.style.width = g), (x.style.height = a._h + "px")), D.appendChild(x));
      }
      D.style.cssText = c;
    }
    (G && (r > D.clientHeight && ((D.style.height = r - N + "px"), D.clientHeight < r && (D.style.height = r + T + "px")), E > D.clientWidth && ((D.style.width = E - L + "px"), D.clientWidth < E && (D.style.width = E + m + "px"))), Q && (U ? (D.style.display = U) : D.style.removeProperty("display")), t(F, O), z && t(C, V), t(i, M));
  }
  function y(D, u, e, t) {
    var F,
      C,
      i,
      n,
      E,
      r,
      l,
      d,
      a =
        u.tag ? u.tag
        : u.span ? "span"
        : "div",
      h = ~(u.type || u.split || "chars,words,lines").indexOf("chars"),
      B = o(u),
      f = u.wordDelimiter || " ",
      A =
        " " !== f ? ""
        : B ? "&#173; "
        : " ",
      c = "</" + a + ">",
      x = 1,
      g =
        u.specialChars ?
          "function" == typeof u.specialChars ?
            u.specialChars
          : p
        : null,
      y = X.createElement("div"),
      v = D.parentNode;
    for (
      v.insertBefore(y, D),
        y.textContent = D.nodeValue,
        v.removeChild(D),
        l =
          -1 !==
          (F = (function getText(D) {
            var u = D.nodeType,
              e = "";
            if (1 === u || 9 === u || 11 === u) {
              if ("string" == typeof D.textContent) return D.textContent;
              for (D = D.firstChild; D; D = D.nextSibling) e += getText(D);
            } else if (3 === u || 4 === u) return D.nodeValue;
            return e;
          })((D = y))).indexOf("<"),
        !1 !== u.reduceWhiteSpace && (F = F.replace(S, " ").replace(b, "")),
        l && (F = F.split("<").join("{{LT}}")),
        E = F.length,
        C = (" " === F.charAt(0) ? A : "") + e(),
        i = 0;
      i < E;
      i++
    )
      if (((r = F.charAt(i)), g && (d = g(F.substr(i), u.specialChars)))) ((r = F.substr(i, d || 1)), (C += h && " " !== r ? t() + r + "</" + a + ">" : r), (i += d - 1));
      else if (r === f && F.charAt(i - 1) !== f && i) {
        for (C += x ? c : "", x = 0; F.charAt(i + 1) === f; ) ((C += A), i++);
        i === E - 1 ? (C += A) : ")" !== F.charAt(i + 1) && ((C += A + e()), (x = 1));
      } else
        "{" === r && "{{LT}}" === F.substr(i, 6) ? ((C += h ? t() + "{{LT}}</" + a + ">" : "{{LT}}"), (i += 5))
        : (55296 <= r.charCodeAt(0) && r.charCodeAt(0) <= 56319) || (65024 <= F.charCodeAt(i + 1) && F.charCodeAt(i + 1) <= 65039) ? ((n = ((F.substr(i, 12).split(_) || [])[1] || "").length || 2), (C += h && " " !== r ? t() + F.substr(i, n) + "</" + a + ">" : F.substr(i, n)), (i += n - 1))
        : (C += h && " " !== r ? t() + r + "</" + a + ">" : r);
    ((D.outerHTML = C + (x ? c : "")), l && s(v, "{{LT}}", "<"));
  }
  function z(D, u, e, t) {
    var F,
      C,
      i = l(D.childNodes),
      E = i.length,
      s = o(u);
    if (3 !== D.nodeType || 1 < E) {
      for (u.absolute = !1, F = 0; F < E; F++) (((C = i[F])._next = C._isFirst = C._parent = C._wordEnd = null), (3 === C.nodeType && !/\S+/.test(C.nodeValue)) || (s && 3 !== C.nodeType && "inline" === n(C).display && ((C.style.display = "inline-block"), (C.style.position = "relative")), (C._isSplit = !0), z(C, u, e, t)));
      return ((u.absolute = s), void (D._isSplit = !0));
    }
    y(D, u, e, t);
  }
  var X,
    e,
    F,
    C,
    i,
    l,
    E,
    b = /(?:\r|\n|\t\t)/g,
    S = /(?:\s\s+)/g,
    d =
      (((E = SplitText.prototype).split = function split(D) {
        (this.isSplit && this.revert(), (this.vars = D = D || this.vars), (this._originals.length = this.chars.length = this.words.length = this.lines.length = 0));
        for (
          var u,
            e,
            t,
            F = this.elements.length,
            C =
              D.tag ? D.tag
              : D.span ? "span"
              : "div",
            i = r(D.wordsClass, C),
            n = r(D.charsClass, C);
          -1 < --F;
        )
          ((t = this.elements[F]), (this._originals[F] = t.innerHTML), (u = t.clientHeight), (e = t.clientWidth), z(t, D, i, n), x(t, D, this.chars, this.words, this.lines, e, u));
        return (this.chars.reverse(), this.words.reverse(), this.lines.reverse(), (this.isSplit = !0), this);
      }),
      (E.revert = function revert() {
        var e = this._originals;
        if (!e) throw "revert() call wasn't scoped properly.";
        return (
          this.elements.forEach(function (D, u) {
            return (D.innerHTML = e[u]);
          }),
          (this.chars = []),
          (this.words = []),
          (this.lines = []),
          (this.isSplit = !1),
          this
        );
      }),
      (SplitText.create = function create(D, u) {
        return new SplitText(D, u);
      }),
      SplitText);
  function SplitText(D, u) {
    (F || m(), (this.elements = l(D)), (this.chars = []), (this.words = []), (this.lines = []), (this._originals = []), (this.vars = u || {}), i(this), this.split(u));
  }
  ((d.version = "3.12.2"), (d.register = m), (D.SplitText = d), (D.default = d));
  if (typeof window === "undefined" || window !== D) {
    Object.defineProperty(D, "__esModule", { value: !0 });
  } else {
    delete D.default;
  }
});

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.window = global.window || {}));
}(this, (function (exports) { 'use strict';

  function _inheritsLoose(subClass, superClass) {
    subClass.prototype = Object.create(superClass.prototype);
    subClass.prototype.constructor = subClass;
    subClass.__proto__ = superClass;
  }

  function _assertThisInitialized(self) {
    if (self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return self;
  }

  /*!
   * GSAP 3.11.3
   * https://greensock.com
   *
   * @license Copyright 2008-2022, GreenSock. All rights reserved.
   * Subject to the terms at https://greensock.com/standard-license or for
   * Club GreenSock members, the agreement issued with that membership.
   * @author: Jack Doyle, jack@greensock.com
  */
  var _config = {
    autoSleep: 120,
    force3D: "auto",
    nullTargetWarn: 1,
    units: {
      lineHeight: ""
    }
  },
      _defaults = {
    duration: .5,
    overwrite: false,
    delay: 0
  },
      _suppressOverwrites,
      _reverting,
      _context,
      _bigNum = 1e8,
      _tinyNum = 1 / _bigNum,
      _2PI = Math.PI * 2,
      _HALF_PI = _2PI / 4,
      _gsID = 0,
      _sqrt = Math.sqrt,
      _cos = Math.cos,
      _sin = Math.sin,
      _isString = function _isString(value) {
    return typeof value === "string";
  },
      _isFunction = function _isFunction(value) {
    return typeof value === "function";
  },
      _isNumber = function _isNumber(value) {
    return typeof value === "number";
  },
      _isUndefined = function _isUndefined(value) {
    return typeof value === "undefined";
  },
      _isObject = function _isObject(value) {
    return typeof value === "object";
  },
      _isNotFalse = function _isNotFalse(value) {
    return value !== false;
  },
      _windowExists = function _windowExists() {
    return typeof window !== "undefined";
  },
      _isFuncOrString = function _isFuncOrString(value) {
    return _isFunction(value) || _isString(value);
  },
      _isTypedArray = typeof ArrayBuffer === "function" && ArrayBuffer.isView || function () {},
      _isArray = Array.isArray,
      _strictNumExp = /(?:-?\.?\d|\.)+/gi,
      _numExp = /[-+=.]*\d+[.e\-+]*\d*[e\-+]*\d*/g,
      _numWithUnitExp = /[-+=.]*\d+[.e-]*\d*[a-z%]*/g,
      _complexStringNumExp = /[-+=.]*\d+\.?\d*(?:e-|e\+)?\d*/gi,
      _relExp = /[+-]=-?[.\d]+/,
      _delimitedValueExp = /[^,'"\[\]\s]+/gi,
      _unitExp = /^[+\-=e\s\d]*\d+[.\d]*([a-z]*|%)\s*$/i,
      _globalTimeline,
      _win,
      _coreInitted,
      _doc,
      _globals = {},
      _installScope = {},
      _coreReady,
      _install = function _install(scope) {
    return (_installScope = _merge(scope, _globals)) && gsap;
  },
      _missingPlugin = function _missingPlugin(property, value) {
    return console.warn("Invalid property", property, "set to", value, "Missing plugin? gsap.registerPlugin()");
  },
      _warn = function _warn(message, suppress) {
    return !suppress && console.warn(message);
  },
      _addGlobal = function _addGlobal(name, obj) {
    return name && (_globals[name] = obj) && _installScope && (_installScope[name] = obj) || _globals;
  },
      _emptyFunc = function _emptyFunc() {
    return 0;
  },
      _startAtRevertConfig = {
    suppressEvents: true,
    isStart: true,
    kill: false
  },
      _revertConfigNoKill = {
    suppressEvents: true,
    kill: false
  },
      _revertConfig = {
    suppressEvents: true
  },
      _reservedProps = {},
      _lazyTweens = [],
      _lazyLookup = {},
      _lastRenderedFrame,
      _plugins = {},
      _effects = {},
      _nextGCFrame = 30,
      _harnessPlugins = [],
      _callbackNames = "",
      _harness = function _harness(targets) {
    var target = targets[0],
        harnessPlugin,
        i;
    _isObject(target) || _isFunction(target) || (targets = [targets]);

    if (!(harnessPlugin = (target._gsap || {}).harness)) {
      i = _harnessPlugins.length;

      while (i-- && !_harnessPlugins[i].targetTest(target)) {}

      harnessPlugin = _harnessPlugins[i];
    }

    i = targets.length;

    while (i--) {
      targets[i] && (targets[i]._gsap || (targets[i]._gsap = new GSCache(targets[i], harnessPlugin))) || targets.splice(i, 1);
    }

    return targets;
  },
      _getCache = function _getCache(target) {
    return target._gsap || _harness(toArray(target))[0]._gsap;
  },
      _getProperty = function _getProperty(target, property, v) {
    return (v = target[property]) && _isFunction(v) ? target[property]() : _isUndefined(v) && target.getAttribute && target.getAttribute(property) || v;
  },
      _forEachName = function _forEachName(names, func) {
    return (names = names.split(",")).forEach(func) || names;
  },
      _round = function _round(value) {
    return Math.round(value * 100000) / 100000 || 0;
  },
      _roundPrecise = function _roundPrecise(value) {
    return Math.round(value * 10000000) / 10000000 || 0;
  },
      _parseRelative = function _parseRelative(start, value) {
    var operator = value.charAt(0),
        end = parseFloat(value.substr(2));
    start = parseFloat(start);
    return operator === "+" ? start + end : operator === "-" ? start - end : operator === "*" ? start * end : start / end;
  },
      _arrayContainsAny = function _arrayContainsAny(toSearch, toFind) {
    var l = toFind.length,
        i = 0;

    for (; toSearch.indexOf(toFind[i]) < 0 && ++i < l;) {}

    return i < l;
  },
      _lazyRender = function _lazyRender() {
    var l = _lazyTweens.length,
        a = _lazyTweens.slice(0),
        i,
        tween;

    _lazyLookup = {};
    _lazyTweens.length = 0;

    for (i = 0; i < l; i++) {
      tween = a[i];
      tween && tween._lazy && (tween.render(tween._lazy[0], tween._lazy[1], true)._lazy = 0);
    }
  },
      _lazySafeRender = function _lazySafeRender(animation, time, suppressEvents, force) {
    _lazyTweens.length && _lazyRender();
    animation.render(time, suppressEvents, force || _reverting && time < 0 && (animation._initted || animation._startAt));
    _lazyTweens.length && _lazyRender();
  },
      _numericIfPossible = function _numericIfPossible(value) {
    var n = parseFloat(value);
    return (n || n === 0) && (value + "").match(_delimitedValueExp).length < 2 ? n : _isString(value) ? value.trim() : value;
  },
      _passThrough = function _passThrough(p) {
    return p;
  },
      _setDefaults = function _setDefaults(obj, defaults) {
    for (var p in defaults) {
      p in obj || (obj[p] = defaults[p]);
    }

    return obj;
  },
      _setKeyframeDefaults = function _setKeyframeDefaults(excludeDuration) {
    return function (obj, defaults) {
      for (var p in defaults) {
        p in obj || p === "duration" && excludeDuration || p === "ease" || (obj[p] = defaults[p]);
      }
    };
  },
      _merge = function _merge(base, toMerge) {
    for (var p in toMerge) {
      base[p] = toMerge[p];
    }

    return base;
  },
      _mergeDeep = function _mergeDeep(base, toMerge) {
    for (var p in toMerge) {
      p !== "__proto__" && p !== "constructor" && p !== "prototype" && (base[p] = _isObject(toMerge[p]) ? _mergeDeep(base[p] || (base[p] = {}), toMerge[p]) : toMerge[p]);
    }

    return base;
  },
      _copyExcluding = function _copyExcluding(obj, excluding) {
    var copy = {},
        p;

    for (p in obj) {
      p in excluding || (copy[p] = obj[p]);
    }

    return copy;
  },
      _inheritDefaults = function _inheritDefaults(vars) {
    var parent = vars.parent || _globalTimeline,
        func = vars.keyframes ? _setKeyframeDefaults(_isArray(vars.keyframes)) : _setDefaults;

    if (_isNotFalse(vars.inherit)) {
      while (parent) {
        func(vars, parent.vars.defaults);
        parent = parent.parent || parent._dp;
      }
    }

    return vars;
  },
      _arraysMatch = function _arraysMatch(a1, a2) {
    var i = a1.length,
        match = i === a2.length;

    while (match && i-- && a1[i] === a2[i]) {}

    return i < 0;
  },
      _addLinkedListItem = function _addLinkedListItem(parent, child, firstProp, lastProp, sortBy) {
    if (firstProp === void 0) {
      firstProp = "_first";
    }

    if (lastProp === void 0) {
      lastProp = "_last";
    }

    var prev = parent[lastProp],
        t;

    if (sortBy) {
      t = child[sortBy];

      while (prev && prev[sortBy] > t) {
        prev = prev._prev;
      }
    }

    if (prev) {
      child._next = prev._next;
      prev._next = child;
    } else {
      child._next = parent[firstProp];
      parent[firstProp] = child;
    }

    if (child._next) {
      child._next._prev = child;
    } else {
      parent[lastProp] = child;
    }

    child._prev = prev;
    child.parent = child._dp = parent;
    return child;
  },
      _removeLinkedListItem = function _removeLinkedListItem(parent, child, firstProp, lastProp) {
    if (firstProp === void 0) {
      firstProp = "_first";
    }

    if (lastProp === void 0) {
      lastProp = "_last";
    }

    var prev = child._prev,
        next = child._next;

    if (prev) {
      prev._next = next;
    } else if (parent[firstProp] === child) {
      parent[firstProp] = next;
    }

    if (next) {
      next._prev = prev;
    } else if (parent[lastProp] === child) {
      parent[lastProp] = prev;
    }

    child._next = child._prev = child.parent = null;
  },
      _removeFromParent = function _removeFromParent(child, onlyIfParentHasAutoRemove) {
    child.parent && (!onlyIfParentHasAutoRemove || child.parent.autoRemoveChildren) && child.parent.remove(child);
    child._act = 0;
  },
      _uncache = function _uncache(animation, child) {
    if (animation && (!child || child._end > animation._dur || child._start < 0)) {
      var a = animation;

      while (a) {
        a._dirty = 1;
        a = a.parent;
      }
    }

    return animation;
  },
      _recacheAncestors = function _recacheAncestors(animation) {
    var parent = animation.parent;

    while (parent && parent.parent) {
      parent._dirty = 1;
      parent.totalDuration();
      parent = parent.parent;
    }

    return animation;
  },
      _rewindStartAt = function _rewindStartAt(tween, totalTime, suppressEvents, force) {
    return tween._startAt && (_reverting ? tween._startAt.revert(_revertConfigNoKill) : tween.vars.immediateRender && !tween.vars.autoRevert || tween._startAt.render(totalTime, true, force));
  },
      _hasNoPausedAncestors = function _hasNoPausedAncestors(animation) {
    return !animation || animation._ts && _hasNoPausedAncestors(animation.parent);
  },
      _elapsedCycleDuration = function _elapsedCycleDuration(animation) {
    return animation._repeat ? _animationCycle(animation._tTime, animation = animation.duration() + animation._rDelay) * animation : 0;
  },
      _animationCycle = function _animationCycle(tTime, cycleDuration) {
    var whole = Math.floor(tTime /= cycleDuration);
    return tTime && whole === tTime ? whole - 1 : whole;
  },
      _parentToChildTotalTime = function _parentToChildTotalTime(parentTime, child) {
    return (parentTime - child._start) * child._ts + (child._ts >= 0 ? 0 : child._dirty ? child.totalDuration() : child._tDur);
  },
      _setEnd = function _setEnd(animation) {
    return animation._end = _roundPrecise(animation._start + (animation._tDur / Math.abs(animation._ts || animation._rts || _tinyNum) || 0));
  },
      _alignPlayhead = function _alignPlayhead(animation, totalTime) {
    var parent = animation._dp;

    if (parent && parent.smoothChildTiming && animation._ts) {
      animation._start = _roundPrecise(parent._time - (animation._ts > 0 ? totalTime / animation._ts : ((animation._dirty ? animation.totalDuration() : animation._tDur) - totalTime) / -animation._ts));

      _setEnd(animation);

      parent._dirty || _uncache(parent, animation);
    }

    return animation;
  },
      _postAddChecks = function _postAddChecks(timeline, child) {
    var t;

    if (child._time || child._initted && !child._dur) {
      t = _parentToChildTotalTime(timeline.rawTime(), child);

      if (!child._dur || _clamp(0, child.totalDuration(), t) - child._tTime > _tinyNum) {
        child.render(t, true);
      }
    }

    if (_uncache(timeline, child)._dp && timeline._initted && timeline._time >= timeline._dur && timeline._ts) {
      if (timeline._dur < timeline.duration()) {
        t = timeline;

        while (t._dp) {
          t.rawTime() >= 0 && t.totalTime(t._tTime);
          t = t._dp;
        }
      }

      timeline._zTime = -_tinyNum;
    }
  },
      _addToTimeline = function _addToTimeline(timeline, child, position, skipChecks) {
    child.parent && _removeFromParent(child);
    child._start = _roundPrecise((_isNumber(position) ? position : position || timeline !== _globalTimeline ? _parsePosition(timeline, position, child) : timeline._time) + child._delay);
    child._end = _roundPrecise(child._start + (child.totalDuration() / Math.abs(child.timeScale()) || 0));

    _addLinkedListItem(timeline, child, "_first", "_last", timeline._sort ? "_start" : 0);

    _isFromOrFromStart(child) || (timeline._recent = child);
    skipChecks || _postAddChecks(timeline, child);
    timeline._ts < 0 && _alignPlayhead(timeline, timeline._tTime);
    return timeline;
  },
      _scrollTrigger = function _scrollTrigger(animation, trigger) {
    return (_globals.ScrollTrigger || _missingPlugin("scrollTrigger", trigger)) && _globals.ScrollTrigger.create(trigger, animation);
  },
      _attemptInitTween = function _attemptInitTween(tween, time, force, suppressEvents, tTime) {
    _initTween(tween, time, tTime);

    if (!tween._initted) {
      return 1;
    }

    if (!force && tween._pt && !_reverting && (tween._dur && tween.vars.lazy !== false || !tween._dur && tween.vars.lazy) && _lastRenderedFrame !== _ticker.frame) {
      _lazyTweens.push(tween);

      tween._lazy = [tTime, suppressEvents];
      return 1;
    }
  },
      _parentPlayheadIsBeforeStart = function _parentPlayheadIsBeforeStart(_ref) {
    var parent = _ref.parent;
    return parent && parent._ts && parent._initted && !parent._lock && (parent.rawTime() < 0 || _parentPlayheadIsBeforeStart(parent));
  },
      _isFromOrFromStart = function _isFromOrFromStart(_ref2) {
    var data = _ref2.data;
    return data === "isFromStart" || data === "isStart";
  },
      _renderZeroDurationTween = function _renderZeroDurationTween(tween, totalTime, suppressEvents, force) {
    var prevRatio = tween.ratio,
        ratio = totalTime < 0 || !totalTime && (!tween._start && _parentPlayheadIsBeforeStart(tween) && !(!tween._initted && _isFromOrFromStart(tween)) || (tween._ts < 0 || tween._dp._ts < 0) && !_isFromOrFromStart(tween)) ? 0 : 1,
        repeatDelay = tween._rDelay,
        tTime = 0,
        pt,
        iteration,
        prevIteration;

    if (repeatDelay && tween._repeat) {
      tTime = _clamp(0, tween._tDur, totalTime);
      iteration = _animationCycle(tTime, repeatDelay);
      tween._yoyo && iteration & 1 && (ratio = 1 - ratio);

      if (iteration !== _animationCycle(tween._tTime, repeatDelay)) {
        prevRatio = 1 - ratio;
        tween.vars.repeatRefresh && tween._initted && tween.invalidate();
      }
    }

    if (ratio !== prevRatio || _reverting || force || tween._zTime === _tinyNum || !totalTime && tween._zTime) {
      if (!tween._initted && _attemptInitTween(tween, totalTime, force, suppressEvents, tTime)) {
        return;
      }

      prevIteration = tween._zTime;
      tween._zTime = totalTime || (suppressEvents ? _tinyNum : 0);
      suppressEvents || (suppressEvents = totalTime && !prevIteration);
      tween.ratio = ratio;
      tween._from && (ratio = 1 - ratio);
      tween._time = 0;
      tween._tTime = tTime;
      pt = tween._pt;

      while (pt) {
        pt.r(ratio, pt.d);
        pt = pt._next;
      }

      totalTime < 0 && _rewindStartAt(tween, totalTime, suppressEvents, true);
      tween._onUpdate && !suppressEvents && _callback(tween, "onUpdate");
      tTime && tween._repeat && !suppressEvents && tween.parent && _callback(tween, "onRepeat");

      if ((totalTime >= tween._tDur || totalTime < 0) && tween.ratio === ratio) {
        ratio && _removeFromParent(tween, 1);

        if (!suppressEvents && !_reverting) {
          _callback(tween, ratio ? "onComplete" : "onReverseComplete", true);

          tween._prom && tween._prom();
        }
      }
    } else if (!tween._zTime) {
      tween._zTime = totalTime;
    }
  },
      _findNextPauseTween = function _findNextPauseTween(animation, prevTime, time) {
    var child;

    if (time > prevTime) {
      child = animation._first;

      while (child && child._start <= time) {
        if (child.data === "isPause" && child._start > prevTime) {
          return child;
        }

        child = child._next;
      }
    } else {
      child = animation._last;

      while (child && child._start >= time) {
        if (child.data === "isPause" && child._start < prevTime) {
          return child;
        }

        child = child._prev;
      }
    }
  },
      _setDuration = function _setDuration(animation, duration, skipUncache, leavePlayhead) {
    var repeat = animation._repeat,
        dur = _roundPrecise(duration) || 0,
        totalProgress = animation._tTime / animation._tDur;
    totalProgress && !leavePlayhead && (animation._time *= dur / animation._dur);
    animation._dur = dur;
    animation._tDur = !repeat ? dur : repeat < 0 ? 1e10 : _roundPrecise(dur * (repeat + 1) + animation._rDelay * repeat);
    totalProgress > 0 && !leavePlayhead && _alignPlayhead(animation, animation._tTime = animation._tDur * totalProgress);
    animation.parent && _setEnd(animation);
    skipUncache || _uncache(animation.parent, animation);
    return animation;
  },
      _onUpdateTotalDuration = function _onUpdateTotalDuration(animation) {
    return animation instanceof Timeline ? _uncache(animation) : _setDuration(animation, animation._dur);
  },
      _zeroPosition = {
    _start: 0,
    endTime: _emptyFunc,
    totalDuration: _emptyFunc
  },
      _parsePosition = function _parsePosition(animation, position, percentAnimation) {
    var labels = animation.labels,
        recent = animation._recent || _zeroPosition,
        clippedDuration = animation.duration() >= _bigNum ? recent.endTime(false) : animation._dur,
        i,
        offset,
        isPercent;

    if (_isString(position) && (isNaN(position) || position in labels)) {
      offset = position.charAt(0);
      isPercent = position.substr(-1) === "%";
      i = position.indexOf("=");

      if (offset === "<" || offset === ">") {
        i >= 0 && (position = position.replace(/=/, ""));
        return (offset === "<" ? recent._start : recent.endTime(recent._repeat >= 0)) + (parseFloat(position.substr(1)) || 0) * (isPercent ? (i < 0 ? recent : percentAnimation).totalDuration() / 100 : 1);
      }

      if (i < 0) {
        position in labels || (labels[position] = clippedDuration);
        return labels[position];
      }

      offset = parseFloat(position.charAt(i - 1) + position.substr(i + 1));

      if (isPercent && percentAnimation) {
        offset = offset / 100 * (_isArray(percentAnimation) ? percentAnimation[0] : percentAnimation).totalDuration();
      }

      return i > 1 ? _parsePosition(animation, position.substr(0, i - 1), percentAnimation) + offset : clippedDuration + offset;
    }

    return position == null ? clippedDuration : +position;
  },
      _createTweenType = function _createTweenType(type, params, timeline) {
    var isLegacy = _isNumber(params[1]),
        varsIndex = (isLegacy ? 2 : 1) + (type < 2 ? 0 : 1),
        vars = params[varsIndex],
        irVars,
        parent;

    isLegacy && (vars.duration = params[1]);
    vars.parent = timeline;

    if (type) {
      irVars = vars;
      parent = timeline;

      while (parent && !("immediateRender" in irVars)) {
        irVars = parent.vars.defaults || {};
        parent = _isNotFalse(parent.vars.inherit) && parent.parent;
      }

      vars.immediateRender = _isNotFalse(irVars.immediateRender);
      type < 2 ? vars.runBackwards = 1 : vars.startAt = params[varsIndex - 1];
    }

    return new Tween(params[0], vars, params[varsIndex + 1]);
  },
      _conditionalReturn = function _conditionalReturn(value, func) {
    return value || value === 0 ? func(value) : func;
  },
      _clamp = function _clamp(min, max, value) {
    return value < min ? min : value > max ? max : value;
  },
      getUnit = function getUnit(value, v) {
    return !_isString(value) || !(v = _unitExp.exec(value)) ? "" : v[1];
  },
      clamp = function clamp(min, max, value) {
    return _conditionalReturn(value, function (v) {
      return _clamp(min, max, v);
    });
  },
      _slice = [].slice,
      _isArrayLike = function _isArrayLike(value, nonEmpty) {
    return value && _isObject(value) && "length" in value && (!nonEmpty && !value.length || value.length - 1 in value && _isObject(value[0])) && !value.nodeType && value !== _win;
  },
      _flatten = function _flatten(ar, leaveStrings, accumulator) {
    if (accumulator === void 0) {
      accumulator = [];
    }

    return ar.forEach(function (value) {
      var _accumulator;

      return _isString(value) && !leaveStrings || _isArrayLike(value, 1) ? (_accumulator = accumulator).push.apply(_accumulator, toArray(value)) : accumulator.push(value);
    }) || accumulator;
  },
      toArray = function toArray(value, scope, leaveStrings) {
    return _context && !scope && _context.selector ? _context.selector(value) : _isString(value) && !leaveStrings && (_coreInitted || !_wake()) ? _slice.call((scope || _doc).querySelectorAll(value), 0) : _isArray(value) ? _flatten(value, leaveStrings) : _isArrayLike(value) ? _slice.call(value, 0) : value ? [value] : [];
  },
      selector = function selector(value) {
    value = toArray(value)[0] || _warn("Invalid scope") || {};
    return function (v) {
      var el = value.current || value.nativeElement || value;
      return toArray(v, el.querySelectorAll ? el : el === value ? _warn("Invalid scope") || _doc.createElement("div") : value);
    };
  },
      shuffle = function shuffle(a) {
    return a.sort(function () {
      return .5 - Math.random();
    });
  },
      distribute = function distribute(v) {
    if (_isFunction(v)) {
      return v;
    }

    var vars = _isObject(v) ? v : {
      each: v
    },
        ease = _parseEase(vars.ease),
        from = vars.from || 0,
        base = parseFloat(vars.base) || 0,
        cache = {},
        isDecimal = from > 0 && from < 1,
        ratios = isNaN(from) || isDecimal,
        axis = vars.axis,
        ratioX = from,
        ratioY = from;

    if (_isString(from)) {
      ratioX = ratioY = {
        center: .5,
        edges: .5,
        end: 1
      }[from] || 0;
    } else if (!isDecimal && ratios) {
      ratioX = from[0];
      ratioY = from[1];
    }

    return function (i, target, a) {
      var l = (a || vars).length,
          distances = cache[l],
          originX,
          originY,
          x,
          y,
          d,
          j,
          max,
          min,
          wrapAt;

      if (!distances) {
        wrapAt = vars.grid === "auto" ? 0 : (vars.grid || [1, _bigNum])[1];

        if (!wrapAt) {
          max = -_bigNum;

          while (max < (max = a[wrapAt++].getBoundingClientRect().left) && wrapAt < l) {}

          wrapAt--;
        }

        distances = cache[l] = [];
        originX = ratios ? Math.min(wrapAt, l) * ratioX - .5 : from % wrapAt;
        originY = wrapAt === _bigNum ? 0 : ratios ? l * ratioY / wrapAt - .5 : from / wrapAt | 0;
        max = 0;
        min = _bigNum;

        for (j = 0; j < l; j++) {
          x = j % wrapAt - originX;
          y = originY - (j / wrapAt | 0);
          distances[j] = d = !axis ? _sqrt(x * x + y * y) : Math.abs(axis === "y" ? y : x);
          d > max && (max = d);
          d < min && (min = d);
        }

        from === "random" && shuffle(distances);
        distances.max = max - min;
        distances.min = min;
        distances.v = l = (parseFloat(vars.amount) || parseFloat(vars.each) * (wrapAt > l ? l - 1 : !axis ? Math.max(wrapAt, l / wrapAt) : axis === "y" ? l / wrapAt : wrapAt) || 0) * (from === "edges" ? -1 : 1);
        distances.b = l < 0 ? base - l : base;
        distances.u = getUnit(vars.amount || vars.each) || 0;
        ease = ease && l < 0 ? _invertEase(ease) : ease;
      }

      l = (distances[i] - distances.min) / distances.max || 0;
      return _roundPrecise(distances.b + (ease ? ease(l) : l) * distances.v) + distances.u;
    };
  },
      _roundModifier = function _roundModifier(v) {
    var p = Math.pow(10, ((v + "").split(".")[1] || "").length);
    return function (raw) {
      var n = _roundPrecise(Math.round(parseFloat(raw) / v) * v * p);

      return (n - n % 1) / p + (_isNumber(raw) ? 0 : getUnit(raw));
    };
  },
      snap = function snap(snapTo, value) {
    var isArray = _isArray(snapTo),
        radius,
        is2D;

    if (!isArray && _isObject(snapTo)) {
      radius = isArray = snapTo.radius || _bigNum;

      if (snapTo.values) {
        snapTo = toArray(snapTo.values);

        if (is2D = !_isNumber(snapTo[0])) {
          radius *= radius;
        }
      } else {
        snapTo = _roundModifier(snapTo.increment);
      }
    }

    return _conditionalReturn(value, !isArray ? _roundModifier(snapTo) : _isFunction(snapTo) ? function (raw) {
      is2D = snapTo(raw);
      return Math.abs(is2D - raw) <= radius ? is2D : raw;
    } : function (raw) {
      var x = parseFloat(is2D ? raw.x : raw),
          y = parseFloat(is2D ? raw.y : 0),
          min = _bigNum,
          closest = 0,
          i = snapTo.length,
          dx,
          dy;

      while (i--) {
        if (is2D) {
          dx = snapTo[i].x - x;
          dy = snapTo[i].y - y;
          dx = dx * dx + dy * dy;
        } else {
          dx = Math.abs(snapTo[i] - x);
        }

        if (dx < min) {
          min = dx;
          closest = i;
        }
      }

      closest = !radius || min <= radius ? snapTo[closest] : raw;
      return is2D || closest === raw || _isNumber(raw) ? closest : closest + getUnit(raw);
    });
  },
      random = function random(min, max, roundingIncrement, returnFunction) {
    return _conditionalReturn(_isArray(min) ? !max : roundingIncrement === true ? !!(roundingIncrement = 0) : !returnFunction, function () {
      return _isArray(min) ? min[~~(Math.random() * min.length)] : (roundingIncrement = roundingIncrement || 1e-5) && (returnFunction = roundingIncrement < 1 ? Math.pow(10, (roundingIncrement + "").length - 2) : 1) && Math.floor(Math.round((min - roundingIncrement / 2 + Math.random() * (max - min + roundingIncrement * .99)) / roundingIncrement) * roundingIncrement * returnFunction) / returnFunction;
    });
  },
      pipe = function pipe() {
    for (var _len = arguments.length, functions = new Array(_len), _key = 0; _key < _len; _key++) {
      functions[_key] = arguments[_key];
    }

    return function (value) {
      return functions.reduce(function (v, f) {
        return f(v);
      }, value);
    };
  },
      unitize = function unitize(func, unit) {
    return function (value) {
      return func(parseFloat(value)) + (unit || getUnit(value));
    };
  },
      normalize = function normalize(min, max, value) {
    return mapRange(min, max, 0, 1, value);
  },
      _wrapArray = function _wrapArray(a, wrapper, value) {
    return _conditionalReturn(value, function (index) {
      return a[~~wrapper(index)];
    });
  },
      wrap = function wrap(min, max, value) {
    var range = max - min;
    return _isArray(min) ? _wrapArray(min, wrap(0, min.length), max) : _conditionalReturn(value, function (value) {
      return (range + (value - min) % range) % range + min;
    });
  },
      wrapYoyo = function wrapYoyo(min, max, value) {
    var range = max - min,
        total = range * 2;
    return _isArray(min) ? _wrapArray(min, wrapYoyo(0, min.length - 1), max) : _conditionalReturn(value, function (value) {
      value = (total + (value - min) % total) % total || 0;
      return min + (value > range ? total - value : value);
    });
  },
      _replaceRandom = function _replaceRandom(value) {
    var prev = 0,
        s = "",
        i,
        nums,
        end,
        isArray;

    while (~(i = value.indexOf("random(", prev))) {
      end = value.indexOf(")", i);
      isArray = value.charAt(i + 7) === "[";
      nums = value.substr(i + 7, end - i - 7).match(isArray ? _delimitedValueExp : _strictNumExp);
      s += value.substr(prev, i - prev) + random(isArray ? nums : +nums[0], isArray ? 0 : +nums[1], +nums[2] || 1e-5);
      prev = end + 1;
    }

    return s + value.substr(prev, value.length - prev);
  },
      mapRange = function mapRange(inMin, inMax, outMin, outMax, value) {
    var inRange = inMax - inMin,
        outRange = outMax - outMin;
    return _conditionalReturn(value, function (value) {
      return outMin + ((value - inMin) / inRange * outRange || 0);
    });
  },
      interpolate = function interpolate(start, end, progress, mutate) {
    var func = isNaN(start + end) ? 0 : function (p) {
      return (1 - p) * start + p * end;
    };

    if (!func) {
      var isString = _isString(start),
          master = {},
          p,
          i,
          interpolators,
          l,
          il;

      progress === true && (mutate = 1) && (progress = null);

      if (isString) {
        start = {
          p: start
        };
        end = {
          p: end
        };
      } else if (_isArray(start) && !_isArray(end)) {
        interpolators = [];
        l = start.length;
        il = l - 2;

        for (i = 1; i < l; i++) {
          interpolators.push(interpolate(start[i - 1], start[i]));
        }

        l--;

        func = function func(p) {
          p *= l;
          var i = Math.min(il, ~~p);
          return interpolators[i](p - i);
        };

        progress = end;
      } else if (!mutate) {
        start = _merge(_isArray(start) ? [] : {}, start);
      }

      if (!interpolators) {
        for (p in end) {
          _addPropTween.call(master, start, p, "get", end[p]);
        }

        func = function func(p) {
          return _renderPropTweens(p, master) || (isString ? start.p : start);
        };
      }
    }

    return _conditionalReturn(progress, func);
  },
      _getLabelInDirection = function _getLabelInDirection(timeline, fromTime, backward) {
    var labels = timeline.labels,
        min = _bigNum,
        p,
        distance,
        label;

    for (p in labels) {
      distance = labels[p] - fromTime;

      if (distance < 0 === !!backward && distance && min > (distance = Math.abs(distance))) {
        label = p;
        min = distance;
      }
    }

    return label;
  },
      _callback = function _callback(animation, type, executeLazyFirst) {
    var v = animation.vars,
        callback = v[type],
        prevContext = _context,
        context = animation._ctx,
        params,
        scope,
        result;

    if (!callback) {
      return;
    }

    params = v[type + "Params"];
    scope = v.callbackScope || animation;
    executeLazyFirst && _lazyTweens.length && _lazyRender();
    context && (_context = context);
    result = params ? callback.apply(scope, params) : callback.call(scope);
    _context = prevContext;
    return result;
  },
      _interrupt = function _interrupt(animation) {
    _removeFromParent(animation);

    animation.scrollTrigger && animation.scrollTrigger.kill(!!_reverting);
    animation.progress() < 1 && _callback(animation, "onInterrupt");
    return animation;
  },
      _quickTween,
      _createPlugin = function _createPlugin(config) {
    config = !config.name && config["default"] || config;

    var name = config.name,
        isFunc = _isFunction(config),
        Plugin = name && !isFunc && config.init ? function () {
      this._props = [];
    } : config,
        instanceDefaults = {
      init: _emptyFunc,
      render: _renderPropTweens,
      add: _addPropTween,
      kill: _killPropTweensOf,
      modifier: _addPluginModifier,
      rawVars: 0
    },
        statics = {
      targetTest: 0,
      get: 0,
      getSetter: _getSetter,
      aliases: {},
      register: 0
    };

    _wake();

    if (config !== Plugin) {
      if (_plugins[name]) {
        return;
      }

      _setDefaults(Plugin, _setDefaults(_copyExcluding(config, instanceDefaults), statics));

      _merge(Plugin.prototype, _merge(instanceDefaults, _copyExcluding(config, statics)));

      _plugins[Plugin.prop = name] = Plugin;

      if (config.targetTest) {
        _harnessPlugins.push(Plugin);

        _reservedProps[name] = 1;
      }

      name = (name === "css" ? "CSS" : name.charAt(0).toUpperCase() + name.substr(1)) + "Plugin";
    }

    _addGlobal(name, Plugin);

    config.register && config.register(gsap, Plugin, PropTween);
  },
      _255 = 255,
      _colorLookup = {
    aqua: [0, _255, _255],
    lime: [0, _255, 0],
    silver: [192, 192, 192],
    black: [0, 0, 0],
    maroon: [128, 0, 0],
    teal: [0, 128, 128],
    blue: [0, 0, _255],
    navy: [0, 0, 128],
    white: [_255, _255, _255],
    olive: [128, 128, 0],
    yellow: [_255, _255, 0],
    orange: [_255, 165, 0],
    gray: [128, 128, 128],
    purple: [128, 0, 128],
    green: [0, 128, 0],
    red: [_255, 0, 0],
    pink: [_255, 192, 203],
    cyan: [0, _255, _255],
    transparent: [_255, _255, _255, 0]
  },
      _hue = function _hue(h, m1, m2) {
    h += h < 0 ? 1 : h > 1 ? -1 : 0;
    return (h * 6 < 1 ? m1 + (m2 - m1) * h * 6 : h < .5 ? m2 : h * 3 < 2 ? m1 + (m2 - m1) * (2 / 3 - h) * 6 : m1) * _255 + .5 | 0;
  },
      splitColor = function splitColor(v, toHSL, forceAlpha) {
    var a = !v ? _colorLookup.black : _isNumber(v) ? [v >> 16, v >> 8 & _255, v & _255] : 0,
        r,
        g,
        b,
        h,
        s,
        l,
        max,
        min,
        d,
        wasHSL;

    if (!a) {
      if (v.substr(-1) === ",") {
        v = v.substr(0, v.length - 1);
      }

      if (_colorLookup[v]) {
        a = _colorLookup[v];
      } else if (v.charAt(0) === "#") {
        if (v.length < 6) {
          r = v.charAt(1);
          g = v.charAt(2);
          b = v.charAt(3);
          v = "#" + r + r + g + g + b + b + (v.length === 5 ? v.charAt(4) + v.charAt(4) : "");
        }

        if (v.length === 9) {
          a = parseInt(v.substr(1, 6), 16);
          return [a >> 16, a >> 8 & _255, a & _255, parseInt(v.substr(7), 16) / 255];
        }

        v = parseInt(v.substr(1), 16);
        a = [v >> 16, v >> 8 & _255, v & _255];
      } else if (v.substr(0, 3) === "hsl") {
        a = wasHSL = v.match(_strictNumExp);

        if (!toHSL) {
          h = +a[0] % 360 / 360;
          s = +a[1] / 100;
          l = +a[2] / 100;
          g = l <= .5 ? l * (s + 1) : l + s - l * s;
          r = l * 2 - g;
          a.length > 3 && (a[3] *= 1);
          a[0] = _hue(h + 1 / 3, r, g);
          a[1] = _hue(h, r, g);
          a[2] = _hue(h - 1 / 3, r, g);
        } else if (~v.indexOf("=")) {
          a = v.match(_numExp);
          forceAlpha && a.length < 4 && (a[3] = 1);
          return a;
        }
      } else {
        a = v.match(_strictNumExp) || _colorLookup.transparent;
      }

      a = a.map(Number);
    }

    if (toHSL && !wasHSL) {
      r = a[0] / _255;
      g = a[1] / _255;
      b = a[2] / _255;
      max = Math.max(r, g, b);
      min = Math.min(r, g, b);
      l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
      }

      a[0] = ~~(h + .5);
      a[1] = ~~(s * 100 + .5);
      a[2] = ~~(l * 100 + .5);
    }

    forceAlpha && a.length < 4 && (a[3] = 1);
    return a;
  },
      _colorOrderData = function _colorOrderData(v) {
    var values = [],
        c = [],
        i = -1;
    v.split(_colorExp).forEach(function (v) {
      var a = v.match(_numWithUnitExp) || [];
      values.push.apply(values, a);
      c.push(i += a.length + 1);
    });
    values.c = c;
    return values;
  },
      _formatColors = function _formatColors(s, toHSL, orderMatchData) {
    var result = "",
        colors = (s + result).match(_colorExp),
        type = toHSL ? "hsla(" : "rgba(",
        i = 0,
        c,
        shell,
        d,
        l;

    if (!colors) {
      return s;
    }

    colors = colors.map(function (color) {
      return (color = splitColor(color, toHSL, 1)) && type + (toHSL ? color[0] + "," + color[1] + "%," + color[2] + "%," + color[3] : color.join(",")) + ")";
    });

    if (orderMatchData) {
      d = _colorOrderData(s);
      c = orderMatchData.c;

      if (c.join(result) !== d.c.join(result)) {
        shell = s.replace(_colorExp, "1").split(_numWithUnitExp);
        l = shell.length - 1;

        for (; i < l; i++) {
          result += shell[i] + (~c.indexOf(i) ? colors.shift() || type + "0,0,0,0)" : (d.length ? d : colors.length ? colors : orderMatchData).shift());
        }
      }
    }

    if (!shell) {
      shell = s.split(_colorExp);
      l = shell.length - 1;

      for (; i < l; i++) {
        result += shell[i] + colors[i];
      }
    }

    return result + shell[l];
  },
      _colorExp = function () {
    var s = "(?:\\b(?:(?:rgb|rgba|hsl|hsla)\\(.+?\\))|\\B#(?:[0-9a-f]{3,4}){1,2}\\b",
        p;

    for (p in _colorLookup) {
      s += "|" + p + "\\b";
    }

    return new RegExp(s + ")", "gi");
  }(),
      _hslExp = /hsl[a]?\(/,
      _colorStringFilter = function _colorStringFilter(a) {
    var combined = a.join(" "),
        toHSL;
    _colorExp.lastIndex = 0;

    if (_colorExp.test(combined)) {
      toHSL = _hslExp.test(combined);
      a[1] = _formatColors(a[1], toHSL);
      a[0] = _formatColors(a[0], toHSL, _colorOrderData(a[1]));
      return true;
    }
  },
      _tickerActive,
      _ticker = function () {
    var _getTime = Date.now,
        _lagThreshold = 500,
        _adjustedLag = 33,
        _startTime = _getTime(),
        _lastUpdate = _startTime,
        _gap = 1000 / 240,
        _nextTime = _gap,
        _listeners = [],
        _id,
        _req,
        _raf,
        _self,
        _delta,
        _i,
        _tick = function _tick(v) {
      var elapsed = _getTime() - _lastUpdate,
          manual = v === true,
          overlap,
          dispatch,
          time,
          frame;

      elapsed > _lagThreshold && (_startTime += elapsed - _adjustedLag);
      _lastUpdate += elapsed;
      time = _lastUpdate - _startTime;
      overlap = time - _nextTime;

      if (overlap > 0 || manual) {
        frame = ++_self.frame;
        _delta = time - _self.time * 1000;
        _self.time = time = time / 1000;
        _nextTime += overlap + (overlap >= _gap ? 4 : _gap - overlap);
        dispatch = 1;
      }

      manual || (_id = _req(_tick));

      if (dispatch) {
        for (_i = 0; _i < _listeners.length; _i++) {
          _listeners[_i](time, _delta, frame, v);
        }
      }
    };

    _self = {
      time: 0,
      frame: 0,
      tick: function tick() {
        _tick(true);
      },
      deltaRatio: function deltaRatio(fps) {
        return _delta / (1000 / (fps || 60));
      },
      wake: function wake() {
        if (_coreReady) {
          if (!_coreInitted && _windowExists()) {
            _win = _coreInitted = window;
            _doc = _win.document || {};
            _globals.gsap = gsap;
            (_win.gsapVersions || (_win.gsapVersions = [])).push(gsap.version);

            _install(_installScope || _win.GreenSockGlobals || !_win.gsap && _win || {});

            _raf = _win.requestAnimationFrame;
          }

          _id && _self.sleep();

          _req = _raf || function (f) {
            return setTimeout(f, _nextTime - _self.time * 1000 + 1 | 0);
          };

          _tickerActive = 1;

          _tick(2);
        }
      },
      sleep: function sleep() {
        (_raf ? _win.cancelAnimationFrame : clearTimeout)(_id);
        _tickerActive = 0;
        _req = _emptyFunc;
      },
      lagSmoothing: function lagSmoothing(threshold, adjustedLag) {
        _lagThreshold = threshold || 1 / _tinyNum;
        _adjustedLag = Math.min(adjustedLag, _lagThreshold, 0);
      },
      fps: function fps(_fps) {
        _gap = 1000 / (_fps || 240);
        _nextTime = _self.time * 1000 + _gap;
      },
      add: function add(callback, once, prioritize) {
        var func = once ? function (t, d, f, v) {
          callback(t, d, f, v);

          _self.remove(func);
        } : callback;

        _self.remove(callback);

        _listeners[prioritize ? "unshift" : "push"](func);

        _wake();

        return func;
      },
      remove: function remove(callback, i) {
        ~(i = _listeners.indexOf(callback)) && _listeners.splice(i, 1) && _i >= i && _i--;
      },
      _listeners: _listeners
    };
    return _self;
  }(),
      _wake = function _wake() {
    return !_tickerActive && _ticker.wake();
  },
      _easeMap = {},
      _customEaseExp = /^[\d.\-M][\d.\-,\s]/,
      _quotesExp = /["']/g,
      _parseObjectInString = function _parseObjectInString(value) {
    var obj = {},
        split = value.substr(1, value.length - 3).split(":"),
        key = split[0],
        i = 1,
        l = split.length,
        index,
        val,
        parsedVal;

    for (; i < l; i++) {
      val = split[i];
      index = i !== l - 1 ? val.lastIndexOf(",") : val.length;
      parsedVal = val.substr(0, index);
      obj[key] = isNaN(parsedVal) ? parsedVal.replace(_quotesExp, "").trim() : +parsedVal;
      key = val.substr(index + 1).trim();
    }

    return obj;
  },
      _valueInParentheses = function _valueInParentheses(value) {
    var open = value.indexOf("(") + 1,
        close = value.indexOf(")"),
        nested = value.indexOf("(", open);
    return value.substring(open, ~nested && nested < close ? value.indexOf(")", close + 1) : close);
  },
      _configEaseFromString = function _configEaseFromString(name) {
    var split = (name + "").split("("),
        ease = _easeMap[split[0]];
    return ease && split.length > 1 && ease.config ? ease.config.apply(null, ~name.indexOf("{") ? [_parseObjectInString(split[1])] : _valueInParentheses(name).split(",").map(_numericIfPossible)) : _easeMap._CE && _customEaseExp.test(name) ? _easeMap._CE("", name) : ease;
  },
      _invertEase = function _invertEase(ease) {
    return function (p) {
      return 1 - ease(1 - p);
    };
  },
      _propagateYoyoEase = function _propagateYoyoEase(timeline, isYoyo) {
    var child = timeline._first,
        ease;

    while (child) {
      if (child instanceof Timeline) {
        _propagateYoyoEase(child, isYoyo);
      } else if (child.vars.yoyoEase && (!child._yoyo || !child._repeat) && child._yoyo !== isYoyo) {
        if (child.timeline) {
          _propagateYoyoEase(child.timeline, isYoyo);
        } else {
          ease = child._ease;
          child._ease = child._yEase;
          child._yEase = ease;
          child._yoyo = isYoyo;
        }
      }

      child = child._next;
    }
  },
      _parseEase = function _parseEase(ease, defaultEase) {
    return !ease ? defaultEase : (_isFunction(ease) ? ease : _easeMap[ease] || _configEaseFromString(ease)) || defaultEase;
  },
      _insertEase = function _insertEase(names, easeIn, easeOut, easeInOut) {
    if (easeOut === void 0) {
      easeOut = function easeOut(p) {
        return 1 - easeIn(1 - p);
      };
    }

    if (easeInOut === void 0) {
      easeInOut = function easeInOut(p) {
        return p < .5 ? easeIn(p * 2) / 2 : 1 - easeIn((1 - p) * 2) / 2;
      };
    }

    var ease = {
      easeIn: easeIn,
      easeOut: easeOut,
      easeInOut: easeInOut
    },
        lowercaseName;

    _forEachName(names, function (name) {
      _easeMap[name] = _globals[name] = ease;
      _easeMap[lowercaseName = name.toLowerCase()] = easeOut;

      for (var p in ease) {
        _easeMap[lowercaseName + (p === "easeIn" ? ".in" : p === "easeOut" ? ".out" : ".inOut")] = _easeMap[name + "." + p] = ease[p];
      }
    });

    return ease;
  },
      _easeInOutFromOut = function _easeInOutFromOut(easeOut) {
    return function (p) {
      return p < .5 ? (1 - easeOut(1 - p * 2)) / 2 : .5 + easeOut((p - .5) * 2) / 2;
    };
  },
      _configElastic = function _configElastic(type, amplitude, period) {
    var p1 = amplitude >= 1 ? amplitude : 1,
        p2 = (period || (type ? .3 : .45)) / (amplitude < 1 ? amplitude : 1),
        p3 = p2 / _2PI * (Math.asin(1 / p1) || 0),
        easeOut = function easeOut(p) {
      return p === 1 ? 1 : p1 * Math.pow(2, -10 * p) * _sin((p - p3) * p2) + 1;
    },
        ease = type === "out" ? easeOut : type === "in" ? function (p) {
      return 1 - easeOut(1 - p);
    } : _easeInOutFromOut(easeOut);

    p2 = _2PI / p2;

    ease.config = function (amplitude, period) {
      return _configElastic(type, amplitude, period);
    };

    return ease;
  },
      _configBack = function _configBack(type, overshoot) {
    if (overshoot === void 0) {
      overshoot = 1.70158;
    }

    var easeOut = function easeOut(p) {
      return p ? --p * p * ((overshoot + 1) * p + overshoot) + 1 : 0;
    },
        ease = type === "out" ? easeOut : type === "in" ? function (p) {
      return 1 - easeOut(1 - p);
    } : _easeInOutFromOut(easeOut);

    ease.config = function (overshoot) {
      return _configBack(type, overshoot);
    };

    return ease;
  };

  _forEachName("Linear,Quad,Cubic,Quart,Quint,Strong", function (name, i) {
    var power = i < 5 ? i + 1 : i;

    _insertEase(name + ",Power" + (power - 1), i ? function (p) {
      return Math.pow(p, power);
    } : function (p) {
      return p;
    }, function (p) {
      return 1 - Math.pow(1 - p, power);
    }, function (p) {
      return p < .5 ? Math.pow(p * 2, power) / 2 : 1 - Math.pow((1 - p) * 2, power) / 2;
    });
  });

  _easeMap.Linear.easeNone = _easeMap.none = _easeMap.Linear.easeIn;

  _insertEase("Elastic", _configElastic("in"), _configElastic("out"), _configElastic());

  (function (n, c) {
    var n1 = 1 / c,
        n2 = 2 * n1,
        n3 = 2.5 * n1,
        easeOut = function easeOut(p) {
      return p < n1 ? n * p * p : p < n2 ? n * Math.pow(p - 1.5 / c, 2) + .75 : p < n3 ? n * (p -= 2.25 / c) * p + .9375 : n * Math.pow(p - 2.625 / c, 2) + .984375;
    };

    _insertEase("Bounce", function (p) {
      return 1 - easeOut(1 - p);
    }, easeOut);
  })(7.5625, 2.75);

  _insertEase("Expo", function (p) {
    return p ? Math.pow(2, 10 * (p - 1)) : 0;
  });

  _insertEase("Circ", function (p) {
    return -(_sqrt(1 - p * p) - 1);
  });

  _insertEase("Sine", function (p) {
    return p === 1 ? 1 : -_cos(p * _HALF_PI) + 1;
  });

  _insertEase("Back", _configBack("in"), _configBack("out"), _configBack());

  _easeMap.SteppedEase = _easeMap.steps = _globals.SteppedEase = {
    config: function config(steps, immediateStart) {
      if (steps === void 0) {
        steps = 1;
      }

      var p1 = 1 / steps,
          p2 = steps + (immediateStart ? 0 : 1),
          p3 = immediateStart ? 1 : 0,
          max = 1 - _tinyNum;
      return function (p) {
        return ((p2 * _clamp(0, max, p) | 0) + p3) * p1;
      };
    }
  };
  _defaults.ease = _easeMap["quad.out"];

  _forEachName("onComplete,onUpdate,onStart,onRepeat,onReverseComplete,onInterrupt", function (name) {
    return _callbackNames += name + "," + name + "Params,";
  });

  var GSCache = function GSCache(target, harness) {
    this.id = _gsID++;
    target._gsap = this;
    this.target = target;
    this.harness = harness;
    this.get = harness ? harness.get : _getProperty;
    this.set = harness ? harness.getSetter : _getSetter;
  };
  var Animation = function () {
    function Animation(vars) {
      this.vars = vars;
      this._delay = +vars.delay || 0;

      if (this._repeat = vars.repeat === Infinity ? -2 : vars.repeat || 0) {
        this._rDelay = vars.repeatDelay || 0;
        this._yoyo = !!vars.yoyo || !!vars.yoyoEase;
      }

      this._ts = 1;

      _setDuration(this, +vars.duration, 1, 1);

      this.data = vars.data;

      if (_context) {
        this._ctx = _context;

        _context.data.push(this);
      }

      _tickerActive || _ticker.wake();
    }

    var _proto = Animation.prototype;

    _proto.delay = function delay(value) {
      if (value || value === 0) {
        this.parent && this.parent.smoothChildTiming && this.startTime(this._start + value - this._delay);
        this._delay = value;
        return this;
      }

      return this._delay;
    };

    _proto.duration = function duration(value) {
      return arguments.length ? this.totalDuration(this._repeat > 0 ? value + (value + this._rDelay) * this._repeat : value) : this.totalDuration() && this._dur;
    };

    _proto.totalDuration = function totalDuration(value) {
      if (!arguments.length) {
        return this._tDur;
      }

      this._dirty = 0;
      return _setDuration(this, this._repeat < 0 ? value : (value - this._repeat * this._rDelay) / (this._repeat + 1));
    };

    _proto.totalTime = function totalTime(_totalTime, suppressEvents) {
      _wake();

      if (!arguments.length) {
        return this._tTime;
      }

      var parent = this._dp;

      if (parent && parent.smoothChildTiming && this._ts) {
        _alignPlayhead(this, _totalTime);

        !parent._dp || parent.parent || _postAddChecks(parent, this);

        while (parent && parent.parent) {
          if (parent.parent._time !== parent._start + (parent._ts >= 0 ? parent._tTime / parent._ts : (parent.totalDuration() - parent._tTime) / -parent._ts)) {
            parent.totalTime(parent._tTime, true);
          }

          parent = parent.parent;
        }

        if (!this.parent && this._dp.autoRemoveChildren && (this._ts > 0 && _totalTime < this._tDur || this._ts < 0 && _totalTime > 0 || !this._tDur && !_totalTime)) {
          _addToTimeline(this._dp, this, this._start - this._delay);
        }
      }

      if (this._tTime !== _totalTime || !this._dur && !suppressEvents || this._initted && Math.abs(this._zTime) === _tinyNum || !_totalTime && !this._initted && (this.add || this._ptLookup)) {
        this._ts || (this._pTime = _totalTime);

        _lazySafeRender(this, _totalTime, suppressEvents);
      }

      return this;
    };

    _proto.time = function time(value, suppressEvents) {
      return arguments.length ? this.totalTime(Math.min(this.totalDuration(), value + _elapsedCycleDuration(this)) % (this._dur + this._rDelay) || (value ? this._dur : 0), suppressEvents) : this._time;
    };

    _proto.totalProgress = function totalProgress(value, suppressEvents) {
      return arguments.length ? this.totalTime(this.totalDuration() * value, suppressEvents) : this.totalDuration() ? Math.min(1, this._tTime / this._tDur) : this.ratio;
    };

    _proto.progress = function progress(value, suppressEvents) {
      return arguments.length ? this.totalTime(this.duration() * (this._yoyo && !(this.iteration() & 1) ? 1 - value : value) + _elapsedCycleDuration(this), suppressEvents) : this.duration() ? Math.min(1, this._time / this._dur) : this.ratio;
    };

    _proto.iteration = function iteration(value, suppressEvents) {
      var cycleDuration = this.duration() + this._rDelay;

      return arguments.length ? this.totalTime(this._time + (value - 1) * cycleDuration, suppressEvents) : this._repeat ? _animationCycle(this._tTime, cycleDuration) + 1 : 1;
    };

    _proto.timeScale = function timeScale(value) {
      if (!arguments.length) {
        return this._rts === -_tinyNum ? 0 : this._rts;
      }

      if (this._rts === value) {
        return this;
      }

      var tTime = this.parent && this._ts ? _parentToChildTotalTime(this.parent._time, this) : this._tTime;
      this._rts = +value || 0;
      this._ts = this._ps || value === -_tinyNum ? 0 : this._rts;
      this.totalTime(_clamp(-this._delay, this._tDur, tTime), true);

      _setEnd(this);

      return _recacheAncestors(this);
    };

    _proto.paused = function paused(value) {
      if (!arguments.length) {
        return this._ps;
      }

      if (this._ps !== value) {
        this._ps = value;

        if (value) {
          this._pTime = this._tTime || Math.max(-this._delay, this.rawTime());
          this._ts = this._act = 0;
        } else {
          _wake();

          this._ts = this._rts;
          this.totalTime(this.parent && !this.parent.smoothChildTiming ? this.rawTime() : this._tTime || this._pTime, this.progress() === 1 && Math.abs(this._zTime) !== _tinyNum && (this._tTime -= _tinyNum));
        }
      }

      return this;
    };

    _proto.startTime = function startTime(value) {
      if (arguments.length) {
        this._start = value;
        var parent = this.parent || this._dp;
        parent && (parent._sort || !this.parent) && _addToTimeline(parent, this, value - this._delay);
        return this;
      }

      return this._start;
    };

    _proto.endTime = function endTime(includeRepeats) {
      return this._start + (_isNotFalse(includeRepeats) ? this.totalDuration() : this.duration()) / Math.abs(this._ts || 1);
    };

    _proto.rawTime = function rawTime(wrapRepeats) {
      var parent = this.parent || this._dp;
      return !parent ? this._tTime : wrapRepeats && (!this._ts || this._repeat && this._time && this.totalProgress() < 1) ? this._tTime % (this._dur + this._rDelay) : !this._ts ? this._tTime : _parentToChildTotalTime(parent.rawTime(wrapRepeats), this);
    };

    _proto.revert = function revert(config) {
      if (config === void 0) {
        config = _revertConfig;
      }

      var prevIsReverting = _reverting;
      _reverting = config;

      if (this._initted || this._startAt) {
        this.timeline && this.timeline.revert(config);
        this.totalTime(-0.01, config.suppressEvents);
      }

      this.data !== "nested" && config.kill !== false && this.kill();
      _reverting = prevIsReverting;
      return this;
    };

    _proto.globalTime = function globalTime(rawTime) {
      var animation = this,
          time = arguments.length ? rawTime : animation.rawTime();

      while (animation) {
        time = animation._start + time / (animation._ts || 1);
        animation = animation._dp;
      }

      return !this.parent && this.vars.immediateRender ? -1 : time;
    };

    _proto.repeat = function repeat(value) {
      if (arguments.length) {
        this._repeat = value === Infinity ? -2 : value;
        return _onUpdateTotalDuration(this);
      }

      return this._repeat === -2 ? Infinity : this._repeat;
    };

    _proto.repeatDelay = function repeatDelay(value) {
      if (arguments.length) {
        var time = this._time;
        this._rDelay = value;

        _onUpdateTotalDuration(this);

        return time ? this.time(time) : this;
      }

      return this._rDelay;
    };

    _proto.yoyo = function yoyo(value) {
      if (arguments.length) {
        this._yoyo = value;
        return this;
      }

      return this._yoyo;
    };

    _proto.seek = function seek(position, suppressEvents) {
      return this.totalTime(_parsePosition(this, position), _isNotFalse(suppressEvents));
    };

    _proto.restart = function restart(includeDelay, suppressEvents) {
      return this.play().totalTime(includeDelay ? -this._delay : 0, _isNotFalse(suppressEvents));
    };

    _proto.play = function play(from, suppressEvents) {
      from != null && this.seek(from, suppressEvents);
      return this.reversed(false).paused(false);
    };

    _proto.reverse = function reverse(from, suppressEvents) {
      from != null && this.seek(from || this.totalDuration(), suppressEvents);
      return this.reversed(true).paused(false);
    };

    _proto.pause = function pause(atTime, suppressEvents) {
      atTime != null && this.seek(atTime, suppressEvents);
      return this.paused(true);
    };

    _proto.resume = function resume() {
      return this.paused(false);
    };

    _proto.reversed = function reversed(value) {
      if (arguments.length) {
        !!value !== this.reversed() && this.timeScale(-this._rts || (value ? -_tinyNum : 0));
        return this;
      }

      return this._rts < 0;
    };

    _proto.invalidate = function invalidate() {
      this._initted = this._act = 0;
      this._zTime = -_tinyNum;
      return this;
    };

    _proto.isActive = function isActive() {
      var parent = this.parent || this._dp,
          start = this._start,
          rawTime;
      return !!(!parent || this._ts && this._initted && parent.isActive() && (rawTime = parent.rawTime(true)) >= start && rawTime < this.endTime(true) - _tinyNum);
    };

    _proto.eventCallback = function eventCallback(type, callback, params) {
      var vars = this.vars;

      if (arguments.length > 1) {
        if (!callback) {
          delete vars[type];
        } else {
          vars[type] = callback;
          params && (vars[type + "Params"] = params);
          type === "onUpdate" && (this._onUpdate = callback);
        }

        return this;
      }

      return vars[type];
    };

    _proto.then = function then(onFulfilled) {
      var self = this;
      return new Promise(function (resolve) {
        var f = _isFunction(onFulfilled) ? onFulfilled : _passThrough,
            _resolve = function _resolve() {
          var _then = self.then;
          self.then = null;
          _isFunction(f) && (f = f(self)) && (f.then || f === self) && (self.then = _then);
          resolve(f);
          self.then = _then;
        };

        if (self._initted && self.totalProgress() === 1 && self._ts >= 0 || !self._tTime && self._ts < 0) {
          _resolve();
        } else {
          self._prom = _resolve;
        }
      });
    };

    _proto.kill = function kill() {
      _interrupt(this);
    };

    return Animation;
  }();

  _setDefaults(Animation.prototype, {
    _time: 0,
    _start: 0,
    _end: 0,
    _tTime: 0,
    _tDur: 0,
    _dirty: 0,
    _repeat: 0,
    _yoyo: false,
    parent: null,
    _initted: false,
    _rDelay: 0,
    _ts: 1,
    _dp: 0,
    ratio: 0,
    _zTime: -_tinyNum,
    _prom: 0,
    _ps: false,
    _rts: 1
  });

  var Timeline = function (_Animation) {
    _inheritsLoose(Timeline, _Animation);

    function Timeline(vars, position) {
      var _this;

      if (vars === void 0) {
        vars = {};
      }

      _this = _Animation.call(this, vars) || this;
      _this.labels = {};
      _this.smoothChildTiming = !!vars.smoothChildTiming;
      _this.autoRemoveChildren = !!vars.autoRemoveChildren;
      _this._sort = _isNotFalse(vars.sortChildren);
      _globalTimeline && _addToTimeline(vars.parent || _globalTimeline, _assertThisInitialized(_this), position);
      vars.reversed && _this.reverse();
      vars.paused && _this.paused(true);
      vars.scrollTrigger && _scrollTrigger(_assertThisInitialized(_this), vars.scrollTrigger);
      return _this;
    }

    var _proto2 = Timeline.prototype;

    _proto2.to = function to(targets, vars, position) {
      _createTweenType(0, arguments, this);

      return this;
    };

    _proto2.from = function from(targets, vars, position) {
      _createTweenType(1, arguments, this);

      return this;
    };

    _proto2.fromTo = function fromTo(targets, fromVars, toVars, position) {
      _createTweenType(2, arguments, this);

      return this;
    };

    _proto2.set = function set(targets, vars, position) {
      vars.duration = 0;
      vars.parent = this;
      _inheritDefaults(vars).repeatDelay || (vars.repeat = 0);
      vars.immediateRender = !!vars.immediateRender;
      new Tween(targets, vars, _parsePosition(this, position), 1);
      return this;
    };

    _proto2.call = function call(callback, params, position) {
      return _addToTimeline(this, Tween.delayedCall(0, callback, params), position);
    };

    _proto2.staggerTo = function staggerTo(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams) {
      vars.duration = duration;
      vars.stagger = vars.stagger || stagger;
      vars.onComplete = onCompleteAll;
      vars.onCompleteParams = onCompleteAllParams;
      vars.parent = this;
      new Tween(targets, vars, _parsePosition(this, position));
      return this;
    };

    _proto2.staggerFrom = function staggerFrom(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams) {
      vars.runBackwards = 1;
      _inheritDefaults(vars).immediateRender = _isNotFalse(vars.immediateRender);
      return this.staggerTo(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams);
    };

    _proto2.staggerFromTo = function staggerFromTo(targets, duration, fromVars, toVars, stagger, position, onCompleteAll, onCompleteAllParams) {
      toVars.startAt = fromVars;
      _inheritDefaults(toVars).immediateRender = _isNotFalse(toVars.immediateRender);
      return this.staggerTo(targets, duration, toVars, stagger, position, onCompleteAll, onCompleteAllParams);
    };

    _proto2.render = function render(totalTime, suppressEvents, force) {
      var prevTime = this._time,
          tDur = this._dirty ? this.totalDuration() : this._tDur,
          dur = this._dur,
          tTime = totalTime <= 0 ? 0 : _roundPrecise(totalTime),
          crossingStart = this._zTime < 0 !== totalTime < 0 && (this._initted || !dur),
          time,
          child,
          next,
          iteration,
          cycleDuration,
          prevPaused,
          pauseTween,
          timeScale,
          prevStart,
          prevIteration,
          yoyo,
          isYoyo;
      this !== _globalTimeline && tTime > tDur && totalTime >= 0 && (tTime = tDur);

      if (tTime !== this._tTime || force || crossingStart) {
        if (prevTime !== this._time && dur) {
          tTime += this._time - prevTime;
          totalTime += this._time - prevTime;
        }

        time = tTime;
        prevStart = this._start;
        timeScale = this._ts;
        prevPaused = !timeScale;

        if (crossingStart) {
          dur || (prevTime = this._zTime);
          (totalTime || !suppressEvents) && (this._zTime = totalTime);
        }

        if (this._repeat) {
          yoyo = this._yoyo;
          cycleDuration = dur + this._rDelay;

          if (this._repeat < -1 && totalTime < 0) {
            return this.totalTime(cycleDuration * 100 + totalTime, suppressEvents, force);
          }

          time = _roundPrecise(tTime % cycleDuration);

          if (tTime === tDur) {
            iteration = this._repeat;
            time = dur;
          } else {
            iteration = ~~(tTime / cycleDuration);

            if (iteration && iteration === tTime / cycleDuration) {
              time = dur;
              iteration--;
            }

            time > dur && (time = dur);
          }

          prevIteration = _animationCycle(this._tTime, cycleDuration);
          !prevTime && this._tTime && prevIteration !== iteration && (prevIteration = iteration);

          if (yoyo && iteration & 1) {
            time = dur - time;
            isYoyo = 1;
          }

          if (iteration !== prevIteration && !this._lock) {
            var rewinding = yoyo && prevIteration & 1,
                doesWrap = rewinding === (yoyo && iteration & 1);
            iteration < prevIteration && (rewinding = !rewinding);
            prevTime = rewinding ? 0 : dur;
            this._lock = 1;
            this.render(prevTime || (isYoyo ? 0 : _roundPrecise(iteration * cycleDuration)), suppressEvents, !dur)._lock = 0;
            this._tTime = tTime;
            !suppressEvents && this.parent && _callback(this, "onRepeat");
            this.vars.repeatRefresh && !isYoyo && (this.invalidate()._lock = 1);

            if (prevTime && prevTime !== this._time || prevPaused !== !this._ts || this.vars.onRepeat && !this.parent && !this._act) {
              return this;
            }

            dur = this._dur;
            tDur = this._tDur;

            if (doesWrap) {
              this._lock = 2;
              prevTime = rewinding ? dur : -0.0001;
              this.render(prevTime, true);
              this.vars.repeatRefresh && !isYoyo && this.invalidate();
            }

            this._lock = 0;

            if (!this._ts && !prevPaused) {
              return this;
            }

            _propagateYoyoEase(this, isYoyo);
          }
        }

        if (this._hasPause && !this._forcing && this._lock < 2) {
          pauseTween = _findNextPauseTween(this, _roundPrecise(prevTime), _roundPrecise(time));

          if (pauseTween) {
            tTime -= time - (time = pauseTween._start);
          }
        }

        this._tTime = tTime;
        this._time = time;
        this._act = !timeScale;

        if (!this._initted) {
          this._onUpdate = this.vars.onUpdate;
          this._initted = 1;
          this._zTime = totalTime;
          prevTime = 0;
        }

        if (!prevTime && time && !suppressEvents) {
          _callback(this, "onStart");

          if (this._tTime !== tTime) {
            return this;
          }
        }

        if (time >= prevTime && totalTime >= 0) {
          child = this._first;

          while (child) {
            next = child._next;

            if ((child._act || time >= child._start) && child._ts && pauseTween !== child) {
              if (child.parent !== this) {
                return this.render(totalTime, suppressEvents, force);
              }

              child.render(child._ts > 0 ? (time - child._start) * child._ts : (child._dirty ? child.totalDuration() : child._tDur) + (time - child._start) * child._ts, suppressEvents, force);

              if (time !== this._time || !this._ts && !prevPaused) {
                pauseTween = 0;
                next && (tTime += this._zTime = -_tinyNum);
                break;
              }
            }

            child = next;
          }
        } else {
          child = this._last;
          var adjustedTime = totalTime < 0 ? totalTime : time;

          while (child) {
            next = child._prev;

            if ((child._act || adjustedTime <= child._end) && child._ts && pauseTween !== child) {
              if (child.parent !== this) {
                return this.render(totalTime, suppressEvents, force);
              }

              child.render(child._ts > 0 ? (adjustedTime - child._start) * child._ts : (child._dirty ? child.totalDuration() : child._tDur) + (adjustedTime - child._start) * child._ts, suppressEvents, force || _reverting && (child._initted || child._startAt));

              if (time !== this._time || !this._ts && !prevPaused) {
                pauseTween = 0;
                next && (tTime += this._zTime = adjustedTime ? -_tinyNum : _tinyNum);
                break;
              }
            }

            child = next;
          }
        }

        if (pauseTween && !suppressEvents) {
          this.pause();
          pauseTween.render(time >= prevTime ? 0 : -_tinyNum)._zTime = time >= prevTime ? 1 : -1;

          if (this._ts) {
            this._start = prevStart;

            _setEnd(this);

            return this.render(totalTime, suppressEvents, force);
          }
        }

        this._onUpdate && !suppressEvents && _callback(this, "onUpdate", true);
        if (tTime === tDur && this._tTime >= this.totalDuration() || !tTime && prevTime) if (prevStart === this._start || Math.abs(timeScale) !== Math.abs(this._ts)) if (!this._lock) {
          (totalTime || !dur) && (tTime === tDur && this._ts > 0 || !tTime && this._ts < 0) && _removeFromParent(this, 1);

          if (!suppressEvents && !(totalTime < 0 && !prevTime) && (tTime || prevTime || !tDur)) {
            _callback(this, tTime === tDur && totalTime >= 0 ? "onComplete" : "onReverseComplete", true);

            this._prom && !(tTime < tDur && this.timeScale() > 0) && this._prom();
          }
        }
      }

      return this;
    };

    _proto2.add = function add(child, position) {
      var _this2 = this;

      _isNumber(position) || (position = _parsePosition(this, position, child));

      if (!(child instanceof Animation)) {
        if (_isArray(child)) {
          child.forEach(function (obj) {
            return _this2.add(obj, position);
          });
          return this;
        }

        if (_isString(child)) {
          return this.addLabel(child, position);
        }

        if (_isFunction(child)) {
          child = Tween.delayedCall(0, child);
        } else {
          return this;
        }
      }

      return this !== child ? _addToTimeline(this, child, position) : this;
    };

    _proto2.getChildren = function getChildren(nested, tweens, timelines, ignoreBeforeTime) {
      if (nested === void 0) {
        nested = true;
      }

      if (tweens === void 0) {
        tweens = true;
      }

      if (timelines === void 0) {
        timelines = true;
      }

      if (ignoreBeforeTime === void 0) {
        ignoreBeforeTime = -_bigNum;
      }

      var a = [],
          child = this._first;

      while (child) {
        if (child._start >= ignoreBeforeTime) {
          if (child instanceof Tween) {
            tweens && a.push(child);
          } else {
            timelines && a.push(child);
            nested && a.push.apply(a, child.getChildren(true, tweens, timelines));
          }
        }

        child = child._next;
      }

      return a;
    };

    _proto2.getById = function getById(id) {
      var animations = this.getChildren(1, 1, 1),
          i = animations.length;

      while (i--) {
        if (animations[i].vars.id === id) {
          return animations[i];
        }
      }
    };

    _proto2.remove = function remove(child) {
      if (_isString(child)) {
        return this.removeLabel(child);
      }

      if (_isFunction(child)) {
        return this.killTweensOf(child);
      }

      _removeLinkedListItem(this, child);

      if (child === this._recent) {
        this._recent = this._last;
      }

      return _uncache(this);
    };

    _proto2.totalTime = function totalTime(_totalTime2, suppressEvents) {
      if (!arguments.length) {
        return this._tTime;
      }

      this._forcing = 1;

      if (!this._dp && this._ts) {
        this._start = _roundPrecise(_ticker.time - (this._ts > 0 ? _totalTime2 / this._ts : (this.totalDuration() - _totalTime2) / -this._ts));
      }

      _Animation.prototype.totalTime.call(this, _totalTime2, suppressEvents);

      this._forcing = 0;
      return this;
    };

    _proto2.addLabel = function addLabel(label, position) {
      this.labels[label] = _parsePosition(this, position);
      return this;
    };

    _proto2.removeLabel = function removeLabel(label) {
      delete this.labels[label];
      return this;
    };

    _proto2.addPause = function addPause(position, callback, params) {
      var t = Tween.delayedCall(0, callback || _emptyFunc, params);
      t.data = "isPause";
      this._hasPause = 1;
      return _addToTimeline(this, t, _parsePosition(this, position));
    };

    _proto2.removePause = function removePause(position) {
      var child = this._first;
      position = _parsePosition(this, position);

      while (child) {
        if (child._start === position && child.data === "isPause") {
          _removeFromParent(child);
        }

        child = child._next;
      }
    };

    _proto2.killTweensOf = function killTweensOf(targets, props, onlyActive) {
      var tweens = this.getTweensOf(targets, onlyActive),
          i = tweens.length;

      while (i--) {
        _overwritingTween !== tweens[i] && tweens[i].kill(targets, props);
      }

      return this;
    };

    _proto2.getTweensOf = function getTweensOf(targets, onlyActive) {
      var a = [],
          parsedTargets = toArray(targets),
          child = this._first,
          isGlobalTime = _isNumber(onlyActive),
          children;

      while (child) {
        if (child instanceof Tween) {
          if (_arrayContainsAny(child._targets, parsedTargets) && (isGlobalTime ? (!_overwritingTween || child._initted && child._ts) && child.globalTime(0) <= onlyActive && child.globalTime(child.totalDuration()) > onlyActive : !onlyActive || child.isActive())) {
            a.push(child);
          }
        } else if ((children = child.getTweensOf(parsedTargets, onlyActive)).length) {
          a.push.apply(a, children);
        }

        child = child._next;
      }

      return a;
    };

    _proto2.tweenTo = function tweenTo(position, vars) {
      vars = vars || {};

      var tl = this,
          endTime = _parsePosition(tl, position),
          _vars = vars,
          startAt = _vars.startAt,
          _onStart = _vars.onStart,
          onStartParams = _vars.onStartParams,
          immediateRender = _vars.immediateRender,
          initted,
          tween = Tween.to(tl, _setDefaults({
        ease: vars.ease || "none",
        lazy: false,
        immediateRender: false,
        time: endTime,
        overwrite: "auto",
        duration: vars.duration || Math.abs((endTime - (startAt && "time" in startAt ? startAt.time : tl._time)) / tl.timeScale()) || _tinyNum,
        onStart: function onStart() {
          tl.pause();

          if (!initted) {
            var duration = vars.duration || Math.abs((endTime - (startAt && "time" in startAt ? startAt.time : tl._time)) / tl.timeScale());
            tween._dur !== duration && _setDuration(tween, duration, 0, 1).render(tween._time, true, true);
            initted = 1;
          }

          _onStart && _onStart.apply(tween, onStartParams || []);
        }
      }, vars));

      return immediateRender ? tween.render(0) : tween;
    };

    _proto2.tweenFromTo = function tweenFromTo(fromPosition, toPosition, vars) {
      return this.tweenTo(toPosition, _setDefaults({
        startAt: {
          time: _parsePosition(this, fromPosition)
        }
      }, vars));
    };

    _proto2.recent = function recent() {
      return this._recent;
    };

    _proto2.nextLabel = function nextLabel(afterTime) {
      if (afterTime === void 0) {
        afterTime = this._time;
      }

      return _getLabelInDirection(this, _parsePosition(this, afterTime));
    };

    _proto2.previousLabel = function previousLabel(beforeTime) {
      if (beforeTime === void 0) {
        beforeTime = this._time;
      }

      return _getLabelInDirection(this, _parsePosition(this, beforeTime), 1);
    };

    _proto2.currentLabel = function currentLabel(value) {
      return arguments.length ? this.seek(value, true) : this.previousLabel(this._time + _tinyNum);
    };

    _proto2.shiftChildren = function shiftChildren(amount, adjustLabels, ignoreBeforeTime) {
      if (ignoreBeforeTime === void 0) {
        ignoreBeforeTime = 0;
      }

      var child = this._first,
          labels = this.labels,
          p;

      while (child) {
        if (child._start >= ignoreBeforeTime) {
          child._start += amount;
          child._end += amount;
        }

        child = child._next;
      }

      if (adjustLabels) {
        for (p in labels) {
          if (labels[p] >= ignoreBeforeTime) {
            labels[p] += amount;
          }
        }
      }

      return _uncache(this);
    };

    _proto2.invalidate = function invalidate(soft) {
      var child = this._first;
      this._lock = 0;

      while (child) {
        child.invalidate(soft);
        child = child._next;
      }

      return _Animation.prototype.invalidate.call(this, soft);
    };

    _proto2.clear = function clear(includeLabels) {
      if (includeLabels === void 0) {
        includeLabels = true;
      }

      var child = this._first,
          next;

      while (child) {
        next = child._next;
        this.remove(child);
        child = next;
      }

      this._dp && (this._time = this._tTime = this._pTime = 0);
      includeLabels && (this.labels = {});
      return _uncache(this);
    };

    _proto2.totalDuration = function totalDuration(value) {
      var max = 0,
          self = this,
          child = self._last,
          prevStart = _bigNum,
          prev,
          start,
          parent;

      if (arguments.length) {
        return self.timeScale((self._repeat < 0 ? self.duration() : self.totalDuration()) / (self.reversed() ? -value : value));
      }

      if (self._dirty) {
        parent = self.parent;

        while (child) {
          prev = child._prev;
          child._dirty && child.totalDuration();
          start = child._start;

          if (start > prevStart && self._sort && child._ts && !self._lock) {
            self._lock = 1;
            _addToTimeline(self, child, start - child._delay, 1)._lock = 0;
          } else {
            prevStart = start;
          }

          if (start < 0 && child._ts) {
            max -= start;

            if (!parent && !self._dp || parent && parent.smoothChildTiming) {
              self._start += start / self._ts;
              self._time -= start;
              self._tTime -= start;
            }

            self.shiftChildren(-start, false, -1e999);
            prevStart = 0;
          }

          child._end > max && child._ts && (max = child._end);
          child = prev;
        }

        _setDuration(self, self === _globalTimeline && self._time > max ? self._time : max, 1, 1);

        self._dirty = 0;
      }

      return self._tDur;
    };

    Timeline.updateRoot = function updateRoot(time) {
      if (_globalTimeline._ts) {
        _lazySafeRender(_globalTimeline, _parentToChildTotalTime(time, _globalTimeline));

        _lastRenderedFrame = _ticker.frame;
      }

      if (_ticker.frame >= _nextGCFrame) {
        _nextGCFrame += _config.autoSleep || 120;
        var child = _globalTimeline._first;
        if (!child || !child._ts) if (_config.autoSleep && _ticker._listeners.length < 2) {
          while (child && !child._ts) {
            child = child._next;
          }

          child || _ticker.sleep();
        }
      }
    };

    return Timeline;
  }(Animation);

  _setDefaults(Timeline.prototype, {
    _lock: 0,
    _hasPause: 0,
    _forcing: 0
  });

  var _addComplexStringPropTween = function _addComplexStringPropTween(target, prop, start, end, setter, stringFilter, funcParam) {
    var pt = new PropTween(this._pt, target, prop, 0, 1, _renderComplexString, null, setter),
        index = 0,
        matchIndex = 0,
        result,
        startNums,
        color,
        endNum,
        chunk,
        startNum,
        hasRandom,
        a;
    pt.b = start;
    pt.e = end;
    start += "";
    end += "";

    if (hasRandom = ~end.indexOf("random(")) {
      end = _replaceRandom(end);
    }

    if (stringFilter) {
      a = [start, end];
      stringFilter(a, target, prop);
      start = a[0];
      end = a[1];
    }

    startNums = start.match(_complexStringNumExp) || [];

    while (result = _complexStringNumExp.exec(end)) {
      endNum = result[0];
      chunk = end.substring(index, result.index);

      if (color) {
        color = (color + 1) % 5;
      } else if (chunk.substr(-5) === "rgba(") {
        color = 1;
      }

      if (endNum !== startNums[matchIndex++]) {
        startNum = parseFloat(startNums[matchIndex - 1]) || 0;
        pt._pt = {
          _next: pt._pt,
          p: chunk || matchIndex === 1 ? chunk : ",",
          s: startNum,
          c: endNum.charAt(1) === "=" ? _parseRelative(startNum, endNum) - startNum : parseFloat(endNum) - startNum,
          m: color && color < 4 ? Math.round : 0
        };
        index = _complexStringNumExp.lastIndex;
      }
    }

    pt.c = index < end.length ? end.substring(index, end.length) : "";
    pt.fp = funcParam;

    if (_relExp.test(end) || hasRandom) {
      pt.e = 0;
    }

    this._pt = pt;
    return pt;
  },
      _addPropTween = function _addPropTween(target, prop, start, end, index, targets, modifier, stringFilter, funcParam, optional) {
    _isFunction(end) && (end = end(index || 0, target, targets));
    var currentValue = target[prop],
        parsedStart = start !== "get" ? start : !_isFunction(currentValue) ? currentValue : funcParam ? target[prop.indexOf("set") || !_isFunction(target["get" + prop.substr(3)]) ? prop : "get" + prop.substr(3)](funcParam) : target[prop](),
        setter = !_isFunction(currentValue) ? _setterPlain : funcParam ? _setterFuncWithParam : _setterFunc,
        pt;

    if (_isString(end)) {
      if (~end.indexOf("random(")) {
        end = _replaceRandom(end);
      }

      if (end.charAt(1) === "=") {
        pt = _parseRelative(parsedStart, end) + (getUnit(parsedStart) || 0);

        if (pt || pt === 0) {
          end = pt;
        }
      }
    }

    if (!optional || parsedStart !== end || _forceAllPropTweens) {
      if (!isNaN(parsedStart * end) && end !== "") {
        pt = new PropTween(this._pt, target, prop, +parsedStart || 0, end - (parsedStart || 0), typeof currentValue === "boolean" ? _renderBoolean : _renderPlain, 0, setter);
        funcParam && (pt.fp = funcParam);
        modifier && pt.modifier(modifier, this, target);
        return this._pt = pt;
      }

      !currentValue && !(prop in target) && _missingPlugin(prop, end);
      return _addComplexStringPropTween.call(this, target, prop, parsedStart, end, setter, stringFilter || _config.stringFilter, funcParam);
    }
  },
      _processVars = function _processVars(vars, index, target, targets, tween) {
    _isFunction(vars) && (vars = _parseFuncOrString(vars, tween, index, target, targets));

    if (!_isObject(vars) || vars.style && vars.nodeType || _isArray(vars) || _isTypedArray(vars)) {
      return _isString(vars) ? _parseFuncOrString(vars, tween, index, target, targets) : vars;
    }

    var copy = {},
        p;

    for (p in vars) {
      copy[p] = _parseFuncOrString(vars[p], tween, index, target, targets);
    }

    return copy;
  },
      _checkPlugin = function _checkPlugin(property, vars, tween, index, target, targets) {
    var plugin, pt, ptLookup, i;

    if (_plugins[property] && (plugin = new _plugins[property]()).init(target, plugin.rawVars ? vars[property] : _processVars(vars[property], index, target, targets, tween), tween, index, targets) !== false) {
      tween._pt = pt = new PropTween(tween._pt, target, property, 0, 1, plugin.render, plugin, 0, plugin.priority);

      if (tween !== _quickTween) {
        ptLookup = tween._ptLookup[tween._targets.indexOf(target)];
        i = plugin._props.length;

        while (i--) {
          ptLookup[plugin._props[i]] = pt;
        }
      }
    }

    return plugin;
  },
      _overwritingTween,
      _forceAllPropTweens,
      _initTween = function _initTween(tween, time, tTime) {
    var vars = tween.vars,
        ease = vars.ease,
        startAt = vars.startAt,
        immediateRender = vars.immediateRender,
        lazy = vars.lazy,
        onUpdate = vars.onUpdate,
        onUpdateParams = vars.onUpdateParams,
        callbackScope = vars.callbackScope,
        runBackwards = vars.runBackwards,
        yoyoEase = vars.yoyoEase,
        keyframes = vars.keyframes,
        autoRevert = vars.autoRevert,
        dur = tween._dur,
        prevStartAt = tween._startAt,
        targets = tween._targets,
        parent = tween.parent,
        fullTargets = parent && parent.data === "nested" ? parent.vars.targets : targets,
        autoOverwrite = tween._overwrite === "auto" && !_suppressOverwrites,
        tl = tween.timeline,
        cleanVars,
        i,
        p,
        pt,
        target,
        hasPriority,
        gsData,
        harness,
        plugin,
        ptLookup,
        index,
        harnessVars,
        overwritten;
    tl && (!keyframes || !ease) && (ease = "none");
    tween._ease = _parseEase(ease, _defaults.ease);
    tween._yEase = yoyoEase ? _invertEase(_parseEase(yoyoEase === true ? ease : yoyoEase, _defaults.ease)) : 0;

    if (yoyoEase && tween._yoyo && !tween._repeat) {
      yoyoEase = tween._yEase;
      tween._yEase = tween._ease;
      tween._ease = yoyoEase;
    }

    tween._from = !tl && !!vars.runBackwards;

    if (!tl || keyframes && !vars.stagger) {
      harness = targets[0] ? _getCache(targets[0]).harness : 0;
      harnessVars = harness && vars[harness.prop];
      cleanVars = _copyExcluding(vars, _reservedProps);

      if (prevStartAt) {
        prevStartAt._zTime < 0 && prevStartAt.progress(1);
        time < 0 && runBackwards && immediateRender && !autoRevert ? prevStartAt.render(-1, true) : prevStartAt.revert(runBackwards && dur ? _revertConfigNoKill : _startAtRevertConfig);
        prevStartAt._lazy = 0;
      }

      if (startAt) {
        _removeFromParent(tween._startAt = Tween.set(targets, _setDefaults({
          data: "isStart",
          overwrite: false,
          parent: parent,
          immediateRender: true,
          lazy: _isNotFalse(lazy),
          startAt: null,
          delay: 0,
          onUpdate: onUpdate,
          onUpdateParams: onUpdateParams,
          callbackScope: callbackScope,
          stagger: 0
        }, startAt)));

        tween._startAt._dp = 0;
        time < 0 && (_reverting || !immediateRender && !autoRevert) && tween._startAt.revert(_revertConfigNoKill);

        if (immediateRender) {
          if (dur && time <= 0 && tTime <= 0) {
            time && (tween._zTime = time);
            return;
          }
        }
      } else if (runBackwards && dur) {
        if (!prevStartAt) {
          time && (immediateRender = false);
          p = _setDefaults({
            overwrite: false,
            data: "isFromStart",
            lazy: immediateRender && _isNotFalse(lazy),
            immediateRender: immediateRender,
            stagger: 0,
            parent: parent
          }, cleanVars);
          harnessVars && (p[harness.prop] = harnessVars);

          _removeFromParent(tween._startAt = Tween.set(targets, p));

          tween._startAt._dp = 0;
          time < 0 && (_reverting ? tween._startAt.revert(_revertConfigNoKill) : tween._startAt.render(-1, true));
          tween._zTime = time;

          if (!immediateRender) {
            _initTween(tween._startAt, _tinyNum, _tinyNum);
          } else if (!time) {
            return;
          }
        }
      }

      tween._pt = tween._ptCache = 0;
      lazy = dur && _isNotFalse(lazy) || lazy && !dur;

      for (i = 0; i < targets.length; i++) {
        target = targets[i];
        gsData = target._gsap || _harness(targets)[i]._gsap;
        tween._ptLookup[i] = ptLookup = {};
        _lazyLookup[gsData.id] && _lazyTweens.length && _lazyRender();
        index = fullTargets === targets ? i : fullTargets.indexOf(target);

        if (harness && (plugin = new harness()).init(target, harnessVars || cleanVars, tween, index, fullTargets) !== false) {
          tween._pt = pt = new PropTween(tween._pt, target, plugin.name, 0, 1, plugin.render, plugin, 0, plugin.priority);

          plugin._props.forEach(function (name) {
            ptLookup[name] = pt;
          });

          plugin.priority && (hasPriority = 1);
        }

        if (!harness || harnessVars) {
          for (p in cleanVars) {
            if (_plugins[p] && (plugin = _checkPlugin(p, cleanVars, tween, index, target, fullTargets))) {
              plugin.priority && (hasPriority = 1);
            } else {
              ptLookup[p] = pt = _addPropTween.call(tween, target, p, "get", cleanVars[p], index, fullTargets, 0, vars.stringFilter);
            }
          }
        }

        tween._op && tween._op[i] && tween.kill(target, tween._op[i]);

        if (autoOverwrite && tween._pt) {
          _overwritingTween = tween;

          _globalTimeline.killTweensOf(target, ptLookup, tween.globalTime(time));

          overwritten = !tween.parent;
          _overwritingTween = 0;
        }

        tween._pt && lazy && (_lazyLookup[gsData.id] = 1);
      }

      hasPriority && _sortPropTweensByPriority(tween);
      tween._onInit && tween._onInit(tween);
    }

    tween._onUpdate = onUpdate;
    tween._initted = (!tween._op || tween._pt) && !overwritten;
    keyframes && time <= 0 && tl.render(_bigNum, true, true);
  },
      _updatePropTweens = function _updatePropTweens(tween, property, value, start, startIsRelative, ratio, time) {
    var ptCache = (tween._pt && tween._ptCache || (tween._ptCache = {}))[property],
        pt,
        rootPT,
        lookup,
        i;

    if (!ptCache) {
      ptCache = tween._ptCache[property] = [];
      lookup = tween._ptLookup;
      i = tween._targets.length;

      while (i--) {
        pt = lookup[i][property];

        if (pt && pt.d && pt.d._pt) {
          pt = pt.d._pt;

          while (pt && pt.p !== property && pt.fp !== property) {
            pt = pt._next;
          }
        }

        if (!pt) {
          _forceAllPropTweens = 1;
          tween.vars[property] = "+=0";

          _initTween(tween, time);

          _forceAllPropTweens = 0;
          return 1;
        }

        ptCache.push(pt);
      }
    }

    i = ptCache.length;

    while (i--) {
      rootPT = ptCache[i];
      pt = rootPT._pt || rootPT;
      pt.s = (start || start === 0) && !startIsRelative ? start : pt.s + (start || 0) + ratio * pt.c;
      pt.c = value - pt.s;
      rootPT.e && (rootPT.e = _round(value) + getUnit(rootPT.e));
      rootPT.b && (rootPT.b = pt.s + getUnit(rootPT.b));
    }
  },
      _addAliasesToVars = function _addAliasesToVars(targets, vars) {
    var harness = targets[0] ? _getCache(targets[0]).harness : 0,
        propertyAliases = harness && harness.aliases,
        copy,
        p,
        i,
        aliases;

    if (!propertyAliases) {
      return vars;
    }

    copy = _merge({}, vars);

    for (p in propertyAliases) {
      if (p in copy) {
        aliases = propertyAliases[p].split(",");
        i = aliases.length;

        while (i--) {
          copy[aliases[i]] = copy[p];
        }
      }
    }

    return copy;
  },
      _parseKeyframe = function _parseKeyframe(prop, obj, allProps, easeEach) {
    var ease = obj.ease || easeEach || "power1.inOut",
        p,
        a;

    if (_isArray(obj)) {
      a = allProps[prop] || (allProps[prop] = []);
      obj.forEach(function (value, i) {
        return a.push({
          t: i / (obj.length - 1) * 100,
          v: value,
          e: ease
        });
      });
    } else {
      for (p in obj) {
        a = allProps[p] || (allProps[p] = []);
        p === "ease" || a.push({
          t: parseFloat(prop),
          v: obj[p],
          e: ease
        });
      }
    }
  },
      _parseFuncOrString = function _parseFuncOrString(value, tween, i, target, targets) {
    return _isFunction(value) ? value.call(tween, i, target, targets) : _isString(value) && ~value.indexOf("random(") ? _replaceRandom(value) : value;
  },
      _staggerTweenProps = _callbackNames + "repeat,repeatDelay,yoyo,repeatRefresh,yoyoEase,autoRevert",
      _staggerPropsToSkip = {};

  _forEachName(_staggerTweenProps + ",id,stagger,delay,duration,paused,scrollTrigger", function (name) {
    return _staggerPropsToSkip[name] = 1;
  });

  var Tween = function (_Animation2) {
    _inheritsLoose(Tween, _Animation2);

    function Tween(targets, vars, position, skipInherit) {
      var _this3;

      if (typeof vars === "number") {
        position.duration = vars;
        vars = position;
        position = null;
      }

      _this3 = _Animation2.call(this, skipInherit ? vars : _inheritDefaults(vars)) || this;
      var _this3$vars = _this3.vars,
          duration = _this3$vars.duration,
          delay = _this3$vars.delay,
          immediateRender = _this3$vars.immediateRender,
          stagger = _this3$vars.stagger,
          overwrite = _this3$vars.overwrite,
          keyframes = _this3$vars.keyframes,
          defaults = _this3$vars.defaults,
          scrollTrigger = _this3$vars.scrollTrigger,
          yoyoEase = _this3$vars.yoyoEase,
          parent = vars.parent || _globalTimeline,
          parsedTargets = (_isArray(targets) || _isTypedArray(targets) ? _isNumber(targets[0]) : "length" in vars) ? [targets] : toArray(targets),
          tl,
          i,
          copy,
          l,
          p,
          curTarget,
          staggerFunc,
          staggerVarsToMerge;
      _this3._targets = parsedTargets.length ? _harness(parsedTargets) : _warn("GSAP target " + targets + " not found. https://greensock.com", !_config.nullTargetWarn) || [];
      _this3._ptLookup = [];
      _this3._overwrite = overwrite;

      if (keyframes || stagger || _isFuncOrString(duration) || _isFuncOrString(delay)) {
        vars = _this3.vars;
        tl = _this3.timeline = new Timeline({
          data: "nested",
          defaults: defaults || {},
          targets: parent && parent.data === "nested" ? parent.vars.targets : parsedTargets
        });
        tl.kill();
        tl.parent = tl._dp = _assertThisInitialized(_this3);
        tl._start = 0;

        if (stagger || _isFuncOrString(duration) || _isFuncOrString(delay)) {
          l = parsedTargets.length;
          staggerFunc = stagger && distribute(stagger);

          if (_isObject(stagger)) {
            for (p in stagger) {
              if (~_staggerTweenProps.indexOf(p)) {
                staggerVarsToMerge || (staggerVarsToMerge = {});
                staggerVarsToMerge[p] = stagger[p];
              }
            }
          }

          for (i = 0; i < l; i++) {
            copy = _copyExcluding(vars, _staggerPropsToSkip);
            copy.stagger = 0;
            yoyoEase && (copy.yoyoEase = yoyoEase);
            staggerVarsToMerge && _merge(copy, staggerVarsToMerge);
            curTarget = parsedTargets[i];
            copy.duration = +_parseFuncOrString(duration, _assertThisInitialized(_this3), i, curTarget, parsedTargets);
            copy.delay = (+_parseFuncOrString(delay, _assertThisInitialized(_this3), i, curTarget, parsedTargets) || 0) - _this3._delay;

            if (!stagger && l === 1 && copy.delay) {
              _this3._delay = delay = copy.delay;
              _this3._start += delay;
              copy.delay = 0;
            }

            tl.to(curTarget, copy, staggerFunc ? staggerFunc(i, curTarget, parsedTargets) : 0);
            tl._ease = _easeMap.none;
          }

          tl.duration() ? duration = delay = 0 : _this3.timeline = 0;
        } else if (keyframes) {
          _inheritDefaults(_setDefaults(tl.vars.defaults, {
            ease: "none"
          }));

          tl._ease = _parseEase(keyframes.ease || vars.ease || "none");
          var time = 0,
              a,
              kf,
              v;

          if (_isArray(keyframes)) {
            keyframes.forEach(function (frame) {
              return tl.to(parsedTargets, frame, ">");
            });
            tl.duration();
          } else {
            copy = {};

            for (p in keyframes) {
              p === "ease" || p === "easeEach" || _parseKeyframe(p, keyframes[p], copy, keyframes.easeEach);
            }

            for (p in copy) {
              a = copy[p].sort(function (a, b) {
                return a.t - b.t;
              });
              time = 0;

              for (i = 0; i < a.length; i++) {
                kf = a[i];
                v = {
                  ease: kf.e,
                  duration: (kf.t - (i ? a[i - 1].t : 0)) / 100 * duration
                };
                v[p] = kf.v;
                tl.to(parsedTargets, v, time);
                time += v.duration;
              }
            }

            tl.duration() < duration && tl.to({}, {
              duration: duration - tl.duration()
            });
          }
        }

        duration || _this3.duration(duration = tl.duration());
      } else {
        _this3.timeline = 0;
      }

      if (overwrite === true && !_suppressOverwrites) {
        _overwritingTween = _assertThisInitialized(_this3);

        _globalTimeline.killTweensOf(parsedTargets);

        _overwritingTween = 0;
      }

      _addToTimeline(parent, _assertThisInitialized(_this3), position);

      vars.reversed && _this3.reverse();
      vars.paused && _this3.paused(true);

      if (immediateRender || !duration && !keyframes && _this3._start === _roundPrecise(parent._time) && _isNotFalse(immediateRender) && _hasNoPausedAncestors(_assertThisInitialized(_this3)) && parent.data !== "nested") {
        _this3._tTime = -_tinyNum;

        _this3.render(Math.max(0, -delay) || 0);
      }

      scrollTrigger && _scrollTrigger(_assertThisInitialized(_this3), scrollTrigger);
      return _this3;
    }

    var _proto3 = Tween.prototype;

    _proto3.render = function render(totalTime, suppressEvents, force) {
      var prevTime = this._time,
          tDur = this._tDur,
          dur = this._dur,
          isNegative = totalTime < 0,
          tTime = totalTime > tDur - _tinyNum && !isNegative ? tDur : totalTime < _tinyNum ? 0 : totalTime,
          time,
          pt,
          iteration,
          cycleDuration,
          prevIteration,
          isYoyo,
          ratio,
          timeline,
          yoyoEase;

      if (!dur) {
        _renderZeroDurationTween(this, totalTime, suppressEvents, force);
      } else if (tTime !== this._tTime || !totalTime || force || !this._initted && this._tTime || this._startAt && this._zTime < 0 !== isNegative) {
        time = tTime;
        timeline = this.timeline;

        if (this._repeat) {
          cycleDuration = dur + this._rDelay;

          if (this._repeat < -1 && isNegative) {
            return this.totalTime(cycleDuration * 100 + totalTime, suppressEvents, force);
          }

          time = _roundPrecise(tTime % cycleDuration);

          if (tTime === tDur) {
            iteration = this._repeat;
            time = dur;
          } else {
            iteration = ~~(tTime / cycleDuration);

            if (iteration && iteration === tTime / cycleDuration) {
              time = dur;
              iteration--;
            }

            time > dur && (time = dur);
          }

          isYoyo = this._yoyo && iteration & 1;

          if (isYoyo) {
            yoyoEase = this._yEase;
            time = dur - time;
          }

          prevIteration = _animationCycle(this._tTime, cycleDuration);

          if (time === prevTime && !force && this._initted) {
            this._tTime = tTime;
            return this;
          }

          if (iteration !== prevIteration) {
            timeline && this._yEase && _propagateYoyoEase(timeline, isYoyo);

            if (this.vars.repeatRefresh && !isYoyo && !this._lock) {
              this._lock = force = 1;
              this.render(_roundPrecise(cycleDuration * iteration), true).invalidate()._lock = 0;
            }
          }
        }

        if (!this._initted) {
          if (_attemptInitTween(this, isNegative ? totalTime : time, force, suppressEvents, tTime)) {
            this._tTime = 0;
            return this;
          }

          if (prevTime !== this._time) {
            return this;
          }

          if (dur !== this._dur) {
            return this.render(totalTime, suppressEvents, force);
          }
        }

        this._tTime = tTime;
        this._time = time;

        if (!this._act && this._ts) {
          this._act = 1;
          this._lazy = 0;
        }

        this.ratio = ratio = (yoyoEase || this._ease)(time / dur);

        if (this._from) {
          this.ratio = ratio = 1 - ratio;
        }

        if (time && !prevTime && !suppressEvents) {
          _callback(this, "onStart");

          if (this._tTime !== tTime) {
            return this;
          }
        }

        pt = this._pt;

        while (pt) {
          pt.r(ratio, pt.d);
          pt = pt._next;
        }

        timeline && timeline.render(totalTime < 0 ? totalTime : !time && isYoyo ? -_tinyNum : timeline._dur * timeline._ease(time / this._dur), suppressEvents, force) || this._startAt && (this._zTime = totalTime);

        if (this._onUpdate && !suppressEvents) {
          isNegative && _rewindStartAt(this, totalTime, suppressEvents, force);

          _callback(this, "onUpdate");
        }

        this._repeat && iteration !== prevIteration && this.vars.onRepeat && !suppressEvents && this.parent && _callback(this, "onRepeat");

        if ((tTime === this._tDur || !tTime) && this._tTime === tTime) {
          isNegative && !this._onUpdate && _rewindStartAt(this, totalTime, true, true);
          (totalTime || !dur) && (tTime === this._tDur && this._ts > 0 || !tTime && this._ts < 0) && _removeFromParent(this, 1);

          if (!suppressEvents && !(isNegative && !prevTime) && (tTime || prevTime || isYoyo)) {
            _callback(this, tTime === tDur ? "onComplete" : "onReverseComplete", true);

            this._prom && !(tTime < tDur && this.timeScale() > 0) && this._prom();
          }
        }
      }

      return this;
    };

    _proto3.targets = function targets() {
      return this._targets;
    };

    _proto3.invalidate = function invalidate(soft) {
      (!soft || !this.vars.runBackwards) && (this._startAt = 0);
      this._pt = this._op = this._onUpdate = this._lazy = this.ratio = 0;
      this._ptLookup = [];
      this.timeline && this.timeline.invalidate(soft);
      return _Animation2.prototype.invalidate.call(this, soft);
    };

    _proto3.resetTo = function resetTo(property, value, start, startIsRelative) {
      _tickerActive || _ticker.wake();
      this._ts || this.play();
      var time = Math.min(this._dur, (this._dp._time - this._start) * this._ts),
          ratio;
      this._initted || _initTween(this, time);
      ratio = this._ease(time / this._dur);

      if (_updatePropTweens(this, property, value, start, startIsRelative, ratio, time)) {
        return this.resetTo(property, value, start, startIsRelative);
      }

      _alignPlayhead(this, 0);

      this.parent || _addLinkedListItem(this._dp, this, "_first", "_last", this._dp._sort ? "_start" : 0);
      return this.render(0);
    };

    _proto3.kill = function kill(targets, vars) {
      if (vars === void 0) {
        vars = "all";
      }

      if (!targets && (!vars || vars === "all")) {
        this._lazy = this._pt = 0;
        return this.parent ? _interrupt(this) : this;
      }

      if (this.timeline) {
        var tDur = this.timeline.totalDuration();
        this.timeline.killTweensOf(targets, vars, _overwritingTween && _overwritingTween.vars.overwrite !== true)._first || _interrupt(this);
        this.parent && tDur !== this.timeline.totalDuration() && _setDuration(this, this._dur * this.timeline._tDur / tDur, 0, 1);
        return this;
      }

      var parsedTargets = this._targets,
          killingTargets = targets ? toArray(targets) : parsedTargets,
          propTweenLookup = this._ptLookup,
          firstPT = this._pt,
          overwrittenProps,
          curLookup,
          curOverwriteProps,
          props,
          p,
          pt,
          i;

      if ((!vars || vars === "all") && _arraysMatch(parsedTargets, killingTargets)) {
        vars === "all" && (this._pt = 0);
        return _interrupt(this);
      }

      overwrittenProps = this._op = this._op || [];

      if (vars !== "all") {
        if (_isString(vars)) {
          p = {};

          _forEachName(vars, function (name) {
            return p[name] = 1;
          });

          vars = p;
        }

        vars = _addAliasesToVars(parsedTargets, vars);
      }

      i = parsedTargets.length;

      while (i--) {
        if (~killingTargets.indexOf(parsedTargets[i])) {
          curLookup = propTweenLookup[i];

          if (vars === "all") {
            overwrittenProps[i] = vars;
            props = curLookup;
            curOverwriteProps = {};
          } else {
            curOverwriteProps = overwrittenProps[i] = overwrittenProps[i] || {};
            props = vars;
          }

          for (p in props) {
            pt = curLookup && curLookup[p];

            if (pt) {
              if (!("kill" in pt.d) || pt.d.kill(p) === true) {
                _removeLinkedListItem(this, pt, "_pt");
              }

              delete curLookup[p];
            }

            if (curOverwriteProps !== "all") {
              curOverwriteProps[p] = 1;
            }
          }
        }
      }

      this._initted && !this._pt && firstPT && _interrupt(this);
      return this;
    };

    Tween.to = function to(targets, vars) {
      return new Tween(targets, vars, arguments[2]);
    };

    Tween.from = function from(targets, vars) {
      return _createTweenType(1, arguments);
    };

    Tween.delayedCall = function delayedCall(delay, callback, params, scope) {
      return new Tween(callback, 0, {
        immediateRender: false,
        lazy: false,
        overwrite: false,
        delay: delay,
        onComplete: callback,
        onReverseComplete: callback,
        onCompleteParams: params,
        onReverseCompleteParams: params,
        callbackScope: scope
      });
    };

    Tween.fromTo = function fromTo(targets, fromVars, toVars) {
      return _createTweenType(2, arguments);
    };

    Tween.set = function set(targets, vars) {
      vars.duration = 0;
      vars.repeatDelay || (vars.repeat = 0);
      return new Tween(targets, vars);
    };

    Tween.killTweensOf = function killTweensOf(targets, props, onlyActive) {
      return _globalTimeline.killTweensOf(targets, props, onlyActive);
    };

    return Tween;
  }(Animation);

  _setDefaults(Tween.prototype, {
    _targets: [],
    _lazy: 0,
    _startAt: 0,
    _op: 0,
    _onInit: 0
  });

  _forEachName("staggerTo,staggerFrom,staggerFromTo", function (name) {
    Tween[name] = function () {
      var tl = new Timeline(),
          params = _slice.call(arguments, 0);

      params.splice(name === "staggerFromTo" ? 5 : 4, 0, 0);
      return tl[name].apply(tl, params);
    };
  });

  var _setterPlain = function _setterPlain(target, property, value) {
    return target[property] = value;
  },
      _setterFunc = function _setterFunc(target, property, value) {
    return target[property](value);
  },
      _setterFuncWithParam = function _setterFuncWithParam(target, property, value, data) {
    return target[property](data.fp, value);
  },
      _setterAttribute = function _setterAttribute(target, property, value) {
    return target.setAttribute(property, value);
  },
      _getSetter = function _getSetter(target, property) {
    return _isFunction(target[property]) ? _setterFunc : _isUndefined(target[property]) && target.setAttribute ? _setterAttribute : _setterPlain;
  },
      _renderPlain = function _renderPlain(ratio, data) {
    return data.set(data.t, data.p, Math.round((data.s + data.c * ratio) * 1000000) / 1000000, data);
  },
      _renderBoolean = function _renderBoolean(ratio, data) {
    return data.set(data.t, data.p, !!(data.s + data.c * ratio), data);
  },
      _renderComplexString = function _renderComplexString(ratio, data) {
    var pt = data._pt,
        s = "";

    if (!ratio && data.b) {
      s = data.b;
    } else if (ratio === 1 && data.e) {
      s = data.e;
    } else {
      while (pt) {
        s = pt.p + (pt.m ? pt.m(pt.s + pt.c * ratio) : Math.round((pt.s + pt.c * ratio) * 10000) / 10000) + s;
        pt = pt._next;
      }

      s += data.c;
    }

    data.set(data.t, data.p, s, data);
  },
      _renderPropTweens = function _renderPropTweens(ratio, data) {
    var pt = data._pt;

    while (pt) {
      pt.r(ratio, pt.d);
      pt = pt._next;
    }
  },
      _addPluginModifier = function _addPluginModifier(modifier, tween, target, property) {
    var pt = this._pt,
        next;

    while (pt) {
      next = pt._next;
      pt.p === property && pt.modifier(modifier, tween, target);
      pt = next;
    }
  },
      _killPropTweensOf = function _killPropTweensOf(property) {
    var pt = this._pt,
        hasNonDependentRemaining,
        next;

    while (pt) {
      next = pt._next;

      if (pt.p === property && !pt.op || pt.op === property) {
        _removeLinkedListItem(this, pt, "_pt");
      } else if (!pt.dep) {
        hasNonDependentRemaining = 1;
      }

      pt = next;
    }

    return !hasNonDependentRemaining;
  },
      _setterWithModifier = function _setterWithModifier(target, property, value, data) {
    data.mSet(target, property, data.m.call(data.tween, value, data.mt), data);
  },
      _sortPropTweensByPriority = function _sortPropTweensByPriority(parent) {
    var pt = parent._pt,
        next,
        pt2,
        first,
        last;

    while (pt) {
      next = pt._next;
      pt2 = first;

      while (pt2 && pt2.pr > pt.pr) {
        pt2 = pt2._next;
      }

      if (pt._prev = pt2 ? pt2._prev : last) {
        pt._prev._next = pt;
      } else {
        first = pt;
      }

      if (pt._next = pt2) {
        pt2._prev = pt;
      } else {
        last = pt;
      }

      pt = next;
    }

    parent._pt = first;
  };

  var PropTween = function () {
    function PropTween(next, target, prop, start, change, renderer, data, setter, priority) {
      this.t = target;
      this.s = start;
      this.c = change;
      this.p = prop;
      this.r = renderer || _renderPlain;
      this.d = data || this;
      this.set = setter || _setterPlain;
      this.pr = priority || 0;
      this._next = next;

      if (next) {
        next._prev = this;
      }
    }

    var _proto4 = PropTween.prototype;

    _proto4.modifier = function modifier(func, tween, target) {
      this.mSet = this.mSet || this.set;
      this.set = _setterWithModifier;
      this.m = func;
      this.mt = target;
      this.tween = tween;
    };

    return PropTween;
  }();

  _forEachName(_callbackNames + "parent,duration,ease,delay,overwrite,runBackwards,startAt,yoyo,immediateRender,repeat,repeatDelay,data,paused,reversed,lazy,callbackScope,stringFilter,id,yoyoEase,stagger,inherit,repeatRefresh,keyframes,autoRevert,scrollTrigger", function (name) {
    return _reservedProps[name] = 1;
  });

  _globals.TweenMax = _globals.TweenLite = Tween;
  _globals.TimelineLite = _globals.TimelineMax = Timeline;
  _globalTimeline = new Timeline({
    sortChildren: false,
    defaults: _defaults,
    autoRemoveChildren: true,
    id: "root",
    smoothChildTiming: true
  });
  _config.stringFilter = _colorStringFilter;

  var _media = [],
      _listeners = {},
      _emptyArray = [],
      _lastMediaTime = 0,
      _dispatch = function _dispatch(type) {
    return (_listeners[type] || _emptyArray).map(function (f) {
      return f();
    });
  },
      _onMediaChange = function _onMediaChange() {
    var time = Date.now(),
        matches = [];

    if (time - _lastMediaTime > 2) {
      _dispatch("matchMediaInit");

      _media.forEach(function (c) {
        var queries = c.queries,
            conditions = c.conditions,
            match,
            p,
            anyMatch,
            toggled;

        for (p in queries) {
          match = _win.matchMedia(queries[p]).matches;
          match && (anyMatch = 1);

          if (match !== conditions[p]) {
            conditions[p] = match;
            toggled = 1;
          }
        }

        if (toggled) {
          c.revert();
          anyMatch && matches.push(c);
        }
      });

      _dispatch("matchMediaRevert");

      matches.forEach(function (c) {
        return c.onMatch(c);
      });
      _lastMediaTime = time;

      _dispatch("matchMedia");
    }
  };

  var Context = function () {
    function Context(func, scope) {
      this.selector = scope && selector(scope);
      this.data = [];
      this._r = [];
      this.isReverted = false;
      func && this.add(func);
    }

    var _proto5 = Context.prototype;

    _proto5.add = function add(name, func, scope) {
      if (_isFunction(name)) {
        scope = func;
        func = name;
        name = _isFunction;
      }

      var self = this,
          f = function f() {
        var prev = _context,
            prevSelector = self.selector,
            result;
        prev && prev !== self && prev.data.push(self);
        scope && (self.selector = selector(scope));
        _context = self;
        result = func.apply(self, arguments);
        _isFunction(result) && self._r.push(result);
        _context = prev;
        self.selector = prevSelector;
        self.isReverted = false;
        return result;
      };

      self.last = f;
      return name === _isFunction ? f(self) : name ? self[name] = f : f;
    };

    _proto5.ignore = function ignore(func) {
      var prev = _context;
      _context = null;
      func(this);
      _context = prev;
    };

    _proto5.getTweens = function getTweens() {
      var a = [];
      this.data.forEach(function (e) {
        return e instanceof Context ? a.push.apply(a, e.getTweens()) : e instanceof Tween && !(e.parent && e.parent.data === "nested") && a.push(e);
      });
      return a;
    };

    _proto5.clear = function clear() {
      this._r.length = this.data.length = 0;
    };

    _proto5.kill = function kill(revert, matchMedia) {
      var _this4 = this;

      if (revert) {
        var tweens = this.getTweens();
        this.data.forEach(function (t) {
          if (t.data === "isFlip") {
            t.revert();
            t.getChildren(true, true, false).forEach(function (tween) {
              return tweens.splice(tweens.indexOf(tween), 1);
            });
          }
        });
        tweens.map(function (t) {
          return {
            g: t.globalTime(0),
            t: t
          };
        }).sort(function (a, b) {
          return b.g - a.g || -1;
        }).forEach(function (o) {
          return o.t.revert(revert);
        });
        this.data.forEach(function (e) {
          return !(e instanceof Animation) && e.revert && e.revert(revert);
        });

        this._r.forEach(function (f) {
          return f(revert, _this4);
        });

        this.isReverted = true;
      } else {
        this.data.forEach(function (e) {
          return e.kill && e.kill();
        });
      }

      this.clear();

      if (matchMedia) {
        var i = _media.indexOf(this);

        !!~i && _media.splice(i, 1);
      }
    };

    _proto5.revert = function revert(config) {
      this.kill(config || {});
    };

    return Context;
  }();

  var MatchMedia = function () {
    function MatchMedia(scope) {
      this.contexts = [];
      this.scope = scope;
    }

    var _proto6 = MatchMedia.prototype;

    _proto6.add = function add(conditions, func, scope) {
      _isObject(conditions) || (conditions = {
        matches: conditions
      });
      var context = new Context(0, scope || this.scope),
          cond = context.conditions = {},
          mq,
          p,
          active;
      this.contexts.push(context);
      func = context.add("onMatch", func);
      context.queries = conditions;

      for (p in conditions) {
        if (p === "all") {
          active = 1;
        } else {
          mq = _win.matchMedia(conditions[p]);

          if (mq) {
            _media.indexOf(context) < 0 && _media.push(context);
            (cond[p] = mq.matches) && (active = 1);
            mq.addListener ? mq.addListener(_onMediaChange) : mq.addEventListener("change", _onMediaChange);
          }
        }
      }

      active && func(context);
      return this;
    };

    _proto6.revert = function revert(config) {
      this.kill(config || {});
    };

    _proto6.kill = function kill(revert) {
      this.contexts.forEach(function (c) {
        return c.kill(revert, true);
      });
    };

    return MatchMedia;
  }();

  var _gsap = {
    registerPlugin: function registerPlugin() {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      args.forEach(function (config) {
        return _createPlugin(config);
      });
    },
    timeline: function timeline(vars) {
      return new Timeline(vars);
    },
    getTweensOf: function getTweensOf(targets, onlyActive) {
      return _globalTimeline.getTweensOf(targets, onlyActive);
    },
    getProperty: function getProperty(target, property, unit, uncache) {
      _isString(target) && (target = toArray(target)[0]);

      var getter = _getCache(target || {}).get,
          format = unit ? _passThrough : _numericIfPossible;

      unit === "native" && (unit = "");
      return !target ? target : !property ? function (property, unit, uncache) {
        return format((_plugins[property] && _plugins[property].get || getter)(target, property, unit, uncache));
      } : format((_plugins[property] && _plugins[property].get || getter)(target, property, unit, uncache));
    },
    quickSetter: function quickSetter(target, property, unit) {
      target = toArray(target);

      if (target.length > 1) {
        var setters = target.map(function (t) {
          return gsap.quickSetter(t, property, unit);
        }),
            l = setters.length;
        return function (value) {
          var i = l;

          while (i--) {
            setters[i](value);
          }
        };
      }

      target = target[0] || {};

      var Plugin = _plugins[property],
          cache = _getCache(target),
          p = cache.harness && (cache.harness.aliases || {})[property] || property,
          setter = Plugin ? function (value) {
        var p = new Plugin();
        _quickTween._pt = 0;
        p.init(target, unit ? value + unit : value, _quickTween, 0, [target]);
        p.render(1, p);
        _quickTween._pt && _renderPropTweens(1, _quickTween);
      } : cache.set(target, p);

      return Plugin ? setter : function (value) {
        return setter(target, p, unit ? value + unit : value, cache, 1);
      };
    },
    quickTo: function quickTo(target, property, vars) {
      var _merge2;

      var tween = gsap.to(target, _merge((_merge2 = {}, _merge2[property] = "+=0.1", _merge2.paused = true, _merge2), vars || {})),
          func = function func(value, start, startIsRelative) {
        return tween.resetTo(property, value, start, startIsRelative);
      };

      func.tween = tween;
      return func;
    },
    isTweening: function isTweening(targets) {
      return _globalTimeline.getTweensOf(targets, true).length > 0;
    },
    defaults: function defaults(value) {
      value && value.ease && (value.ease = _parseEase(value.ease, _defaults.ease));
      return _mergeDeep(_defaults, value || {});
    },
    config: function config(value) {
      return _mergeDeep(_config, value || {});
    },
    registerEffect: function registerEffect(_ref3) {
      var name = _ref3.name,
          effect = _ref3.effect,
          plugins = _ref3.plugins,
          defaults = _ref3.defaults,
          extendTimeline = _ref3.extendTimeline;
      (plugins || "").split(",").forEach(function (pluginName) {
        return pluginName && !_plugins[pluginName] && !_globals[pluginName] && _warn(name + " effect requires " + pluginName + " plugin.");
      });

      _effects[name] = function (targets, vars, tl) {
        return effect(toArray(targets), _setDefaults(vars || {}, defaults), tl);
      };

      if (extendTimeline) {
        Timeline.prototype[name] = function (targets, vars, position) {
          return this.add(_effects[name](targets, _isObject(vars) ? vars : (position = vars) && {}, this), position);
        };
      }
    },
    registerEase: function registerEase(name, ease) {
      _easeMap[name] = _parseEase(ease);
    },
    parseEase: function parseEase(ease, defaultEase) {
      return arguments.length ? _parseEase(ease, defaultEase) : _easeMap;
    },
    getById: function getById(id) {
      return _globalTimeline.getById(id);
    },
    exportRoot: function exportRoot(vars, includeDelayedCalls) {
      if (vars === void 0) {
        vars = {};
      }

      var tl = new Timeline(vars),
          child,
          next;
      tl.smoothChildTiming = _isNotFalse(vars.smoothChildTiming);

      _globalTimeline.remove(tl);

      tl._dp = 0;
      tl._time = tl._tTime = _globalTimeline._time;
      child = _globalTimeline._first;

      while (child) {
        next = child._next;

        if (includeDelayedCalls || !(!child._dur && child instanceof Tween && child.vars.onComplete === child._targets[0])) {
          _addToTimeline(tl, child, child._start - child._delay);
        }

        child = next;
      }

      _addToTimeline(_globalTimeline, tl, 0);

      return tl;
    },
    context: function context(func, scope) {
      return func ? new Context(func, scope) : _context;
    },
    matchMedia: function matchMedia(scope) {
      return new MatchMedia(scope);
    },
    matchMediaRefresh: function matchMediaRefresh() {
      return _media.forEach(function (c) {
        var cond = c.conditions,
            found,
            p;

        for (p in cond) {
          if (cond[p]) {
            cond[p] = false;
            found = 1;
          }
        }

        found && c.revert();
      }) || _onMediaChange();
    },
    addEventListener: function addEventListener(type, callback) {
      var a = _listeners[type] || (_listeners[type] = []);
      ~a.indexOf(callback) || a.push(callback);
    },
    removeEventListener: function removeEventListener(type, callback) {
      var a = _listeners[type],
          i = a && a.indexOf(callback);
      i >= 0 && a.splice(i, 1);
    },
    utils: {
      wrap: wrap,
      wrapYoyo: wrapYoyo,
      distribute: distribute,
      random: random,
      snap: snap,
      normalize: normalize,
      getUnit: getUnit,
      clamp: clamp,
      splitColor: splitColor,
      toArray: toArray,
      selector: selector,
      mapRange: mapRange,
      pipe: pipe,
      unitize: unitize,
      interpolate: interpolate,
      shuffle: shuffle
    },
    install: _install,
    effects: _effects,
    ticker: _ticker,
    updateRoot: Timeline.updateRoot,
    plugins: _plugins,
    globalTimeline: _globalTimeline,
    core: {
      PropTween: PropTween,
      globals: _addGlobal,
      Tween: Tween,
      Timeline: Timeline,
      Animation: Animation,
      getCache: _getCache,
      _removeLinkedListItem: _removeLinkedListItem,
      reverting: function reverting() {
        return _reverting;
      },
      context: function context(toAdd) {
        if (toAdd && _context) {
          _context.data.push(toAdd);

          toAdd._ctx = _context;
        }

        return _context;
      },
      suppressOverwrites: function suppressOverwrites(value) {
        return _suppressOverwrites = value;
      }
    }
  };

  _forEachName("to,from,fromTo,delayedCall,set,killTweensOf", function (name) {
    return _gsap[name] = Tween[name];
  });

  _ticker.add(Timeline.updateRoot);

  _quickTween = _gsap.to({}, {
    duration: 0
  });

  var _getPluginPropTween = function _getPluginPropTween(plugin, prop) {
    var pt = plugin._pt;

    while (pt && pt.p !== prop && pt.op !== prop && pt.fp !== prop) {
      pt = pt._next;
    }

    return pt;
  },
      _addModifiers = function _addModifiers(tween, modifiers) {
    var targets = tween._targets,
        p,
        i,
        pt;

    for (p in modifiers) {
      i = targets.length;

      while (i--) {
        pt = tween._ptLookup[i][p];

        if (pt && (pt = pt.d)) {
          if (pt._pt) {
            pt = _getPluginPropTween(pt, p);
          }

          pt && pt.modifier && pt.modifier(modifiers[p], tween, targets[i], p);
        }
      }
    }
  },
      _buildModifierPlugin = function _buildModifierPlugin(name, modifier) {
    return {
      name: name,
      rawVars: 1,
      init: function init(target, vars, tween) {
        tween._onInit = function (tween) {
          var temp, p;

          if (_isString(vars)) {
            temp = {};

            _forEachName(vars, function (name) {
              return temp[name] = 1;
            });

            vars = temp;
          }

          if (modifier) {
            temp = {};

            for (p in vars) {
              temp[p] = modifier(vars[p]);
            }

            vars = temp;
          }

          _addModifiers(tween, vars);
        };
      }
    };
  };

  var gsap = _gsap.registerPlugin({
    name: "attr",
    init: function init(target, vars, tween, index, targets) {
      var p, pt, v;
      this.tween = tween;

      for (p in vars) {
        v = target.getAttribute(p) || "";
        pt = this.add(target, "setAttribute", (v || 0) + "", vars[p], index, targets, 0, 0, p);
        pt.op = p;
        pt.b = v;

        this._props.push(p);
      }
    },
    render: function render(ratio, data) {
      var pt = data._pt;

      while (pt) {
        _reverting ? pt.set(pt.t, pt.p, pt.b, pt) : pt.r(ratio, pt.d);
        pt = pt._next;
      }
    }
  }, {
    name: "endArray",
    init: function init(target, value) {
      var i = value.length;

      while (i--) {
        this.add(target, i, target[i] || 0, value[i], 0, 0, 0, 0, 0, 1);
      }
    }
  }, _buildModifierPlugin("roundProps", _roundModifier), _buildModifierPlugin("modifiers"), _buildModifierPlugin("snap", snap)) || _gsap;
  Tween.version = Timeline.version = gsap.version = "3.11.3";
  _coreReady = 1;
  _windowExists() && _wake();
  var Power0 = _easeMap.Power0,
      Power1 = _easeMap.Power1,
      Power2 = _easeMap.Power2,
      Power3 = _easeMap.Power3,
      Power4 = _easeMap.Power4,
      Linear = _easeMap.Linear,
      Quad = _easeMap.Quad,
      Cubic = _easeMap.Cubic,
      Quart = _easeMap.Quart,
      Quint = _easeMap.Quint,
      Strong = _easeMap.Strong,
      Elastic = _easeMap.Elastic,
      Back = _easeMap.Back,
      SteppedEase = _easeMap.SteppedEase,
      Bounce = _easeMap.Bounce,
      Sine = _easeMap.Sine,
      Expo = _easeMap.Expo,
      Circ = _easeMap.Circ;

  var _win$1,
      _doc$1,
      _docElement,
      _pluginInitted,
      _tempDiv,
      _tempDivStyler,
      _recentSetterPlugin,
      _reverting$1,
      _windowExists$1 = function _windowExists() {
    return typeof window !== "undefined";
  },
      _transformProps = {},
      _RAD2DEG = 180 / Math.PI,
      _DEG2RAD = Math.PI / 180,
      _atan2 = Math.atan2,
      _bigNum$1 = 1e8,
      _capsExp = /([A-Z])/g,
      _horizontalExp = /(left|right|width|margin|padding|x)/i,
      _complexExp = /[\s,\(]\S/,
      _propertyAliases = {
    autoAlpha: "opacity,visibility",
    scale: "scaleX,scaleY",
    alpha: "opacity"
  },
      _renderCSSProp = function _renderCSSProp(ratio, data) {
    return data.set(data.t, data.p, Math.round((data.s + data.c * ratio) * 10000) / 10000 + data.u, data);
  },
      _renderPropWithEnd = function _renderPropWithEnd(ratio, data) {
    return data.set(data.t, data.p, ratio === 1 ? data.e : Math.round((data.s + data.c * ratio) * 10000) / 10000 + data.u, data);
  },
      _renderCSSPropWithBeginning = function _renderCSSPropWithBeginning(ratio, data) {
    return data.set(data.t, data.p, ratio ? Math.round((data.s + data.c * ratio) * 10000) / 10000 + data.u : data.b, data);
  },
      _renderRoundedCSSProp = function _renderRoundedCSSProp(ratio, data) {
    var value = data.s + data.c * ratio;
    data.set(data.t, data.p, ~~(value + (value < 0 ? -.5 : .5)) + data.u, data);
  },
      _renderNonTweeningValue = function _renderNonTweeningValue(ratio, data) {
    return data.set(data.t, data.p, ratio ? data.e : data.b, data);
  },
      _renderNonTweeningValueOnlyAtEnd = function _renderNonTweeningValueOnlyAtEnd(ratio, data) {
    return data.set(data.t, data.p, ratio !== 1 ? data.b : data.e, data);
  },
      _setterCSSStyle = function _setterCSSStyle(target, property, value) {
    return target.style[property] = value;
  },
      _setterCSSProp = function _setterCSSProp(target, property, value) {
    return target.style.setProperty(property, value);
  },
      _setterTransform = function _setterTransform(target, property, value) {
    return target._gsap[property] = value;
  },
      _setterScale = function _setterScale(target, property, value) {
    return target._gsap.scaleX = target._gsap.scaleY = value;
  },
      _setterScaleWithRender = function _setterScaleWithRender(target, property, value, data, ratio) {
    var cache = target._gsap;
    cache.scaleX = cache.scaleY = value;
    cache.renderTransform(ratio, cache);
  },
      _setterTransformWithRender = function _setterTransformWithRender(target, property, value, data, ratio) {
    var cache = target._gsap;
    cache[property] = value;
    cache.renderTransform(ratio, cache);
  },
      _transformProp = "transform",
      _transformOriginProp = _transformProp + "Origin",
      _saveStyle = function _saveStyle(property, isNotCSS) {
    var _this = this;

    var target = this.target,
        style = target.style;

    if (property in _transformProps) {
      this.tfm = this.tfm || {};

      if (property !== "transform") {
        property = _propertyAliases[property] || property;
        ~property.indexOf(",") ? property.split(",").forEach(function (a) {
          return _this.tfm[a] = _get(target, a);
        }) : this.tfm[property] = target._gsap.x ? target._gsap[property] : _get(target, property);
      }

      if (this.props.indexOf(_transformProp) >= 0) {
        return;
      }

      if (target._gsap.svg) {
        this.svgo = target.getAttribute("data-svg-origin");
        this.props.push(_transformOriginProp, isNotCSS, "");
      }

      property = _transformProp;
    }

    (style || isNotCSS) && this.props.push(property, isNotCSS, style[property]);
  },
      _removeIndependentTransforms = function _removeIndependentTransforms(style) {
    if (style.translate) {
      style.removeProperty("translate");
      style.removeProperty("scale");
      style.removeProperty("rotate");
    }
  },
      _revertStyle = function _revertStyle() {
    var props = this.props,
        target = this.target,
        style = target.style,
        cache = target._gsap,
        i,
        p;

    for (i = 0; i < props.length; i += 3) {
      props[i + 1] ? target[props[i]] = props[i + 2] : props[i + 2] ? style[props[i]] = props[i + 2] : style.removeProperty(props[i].replace(_capsExp, "-$1").toLowerCase());
    }

    if (this.tfm) {
      for (p in this.tfm) {
        cache[p] = this.tfm[p];
      }

      if (cache.svg) {
        cache.renderTransform();
        target.setAttribute("data-svg-origin", this.svgo || "");
      }

      i = _reverting$1();

      if (i && !i.isStart && !style[_transformProp]) {
        _removeIndependentTransforms(style);

        cache.uncache = 1;
      }
    }
  },
      _getStyleSaver = function _getStyleSaver(target, properties) {
    var saver = {
      target: target,
      props: [],
      revert: _revertStyle,
      save: _saveStyle
    };
    properties && properties.split(",").forEach(function (p) {
      return saver.save(p);
    });
    return saver;
  },
      _supports3D,
      _createElement = function _createElement(type, ns) {
    var e = _doc$1.createElementNS ? _doc$1.createElementNS((ns || "http://www.w3.org/1999/xhtml").replace(/^https/, "http"), type) : _doc$1.createElement(type);
    return e.style ? e : _doc$1.createElement(type);
  },
      _getComputedProperty = function _getComputedProperty(target, property, skipPrefixFallback) {
    var cs = getComputedStyle(target);
    return cs[property] || cs.getPropertyValue(property.replace(_capsExp, "-$1").toLowerCase()) || cs.getPropertyValue(property) || !skipPrefixFallback && _getComputedProperty(target, _checkPropPrefix(property) || property, 1) || "";
  },
      _prefixes = "O,Moz,ms,Ms,Webkit".split(","),
      _checkPropPrefix = function _checkPropPrefix(property, element, preferPrefix) {
    var e = element || _tempDiv,
        s = e.style,
        i = 5;

    if (property in s && !preferPrefix) {
      return property;
    }

    property = property.charAt(0).toUpperCase() + property.substr(1);

    while (i-- && !(_prefixes[i] + property in s)) {}

    return i < 0 ? null : (i === 3 ? "ms" : i >= 0 ? _prefixes[i] : "") + property;
  },
      _initCore = function _initCore() {
    if (_windowExists$1() && window.document) {
      _win$1 = window;
      _doc$1 = _win$1.document;
      _docElement = _doc$1.documentElement;
      _tempDiv = _createElement("div") || {
        style: {}
      };
      _tempDivStyler = _createElement("div");
      _transformProp = _checkPropPrefix(_transformProp);
      _transformOriginProp = _transformProp + "Origin";
      _tempDiv.style.cssText = "border-width:0;line-height:0;position:absolute;padding:0";
      _supports3D = !!_checkPropPrefix("perspective");
      _reverting$1 = gsap.core.reverting;
      _pluginInitted = 1;
    }
  },
      _getBBoxHack = function _getBBoxHack(swapIfPossible) {
    var svg = _createElement("svg", this.ownerSVGElement && this.ownerSVGElement.getAttribute("xmlns") || "http://www.w3.org/2000/svg"),
        oldParent = this.parentNode,
        oldSibling = this.nextSibling,
        oldCSS = this.style.cssText,
        bbox;

    _docElement.appendChild(svg);

    svg.appendChild(this);
    this.style.display = "block";

    if (swapIfPossible) {
      try {
        bbox = this.getBBox();
        this._gsapBBox = this.getBBox;
        this.getBBox = _getBBoxHack;
      } catch (e) {}
    } else if (this._gsapBBox) {
      bbox = this._gsapBBox();
    }

    if (oldParent) {
      if (oldSibling) {
        oldParent.insertBefore(this, oldSibling);
      } else {
        oldParent.appendChild(this);
      }
    }

    _docElement.removeChild(svg);

    this.style.cssText = oldCSS;
    return bbox;
  },
      _getAttributeFallbacks = function _getAttributeFallbacks(target, attributesArray) {
    var i = attributesArray.length;

    while (i--) {
      if (target.hasAttribute(attributesArray[i])) {
        return target.getAttribute(attributesArray[i]);
      }
    }
  },
      _getBBox = function _getBBox(target) {
    var bounds;

    try {
      bounds = target.getBBox();
    } catch (error) {
      bounds = _getBBoxHack.call(target, true);
    }

    bounds && (bounds.width || bounds.height) || target.getBBox === _getBBoxHack || (bounds = _getBBoxHack.call(target, true));
    return bounds && !bounds.width && !bounds.x && !bounds.y ? {
      x: +_getAttributeFallbacks(target, ["x", "cx", "x1"]) || 0,
      y: +_getAttributeFallbacks(target, ["y", "cy", "y1"]) || 0,
      width: 0,
      height: 0
    } : bounds;
  },
      _isSVG = function _isSVG(e) {
    return !!(e.getCTM && (!e.parentNode || e.ownerSVGElement) && _getBBox(e));
  },
      _removeProperty = function _removeProperty(target, property) {
    if (property) {
      var style = target.style;

      if (property in _transformProps && property !== _transformOriginProp) {
        property = _transformProp;
      }

      if (style.removeProperty) {
        if (property.substr(0, 2) === "ms" || property.substr(0, 6) === "webkit") {
          property = "-" + property;
        }

        style.removeProperty(property.replace(_capsExp, "-$1").toLowerCase());
      } else {
        style.removeAttribute(property);
      }
    }
  },
      _addNonTweeningPT = function _addNonTweeningPT(plugin, target, property, beginning, end, onlySetAtEnd) {
    var pt = new PropTween(plugin._pt, target, property, 0, 1, onlySetAtEnd ? _renderNonTweeningValueOnlyAtEnd : _renderNonTweeningValue);
    plugin._pt = pt;
    pt.b = beginning;
    pt.e = end;

    plugin._props.push(property);

    return pt;
  },
      _nonConvertibleUnits = {
    deg: 1,
    rad: 1,
    turn: 1
  },
      _nonStandardLayouts = {
    grid: 1,
    flex: 1
  },
      _convertToUnit = function _convertToUnit(target, property, value, unit) {
    var curValue = parseFloat(value) || 0,
        curUnit = (value + "").trim().substr((curValue + "").length) || "px",
        style = _tempDiv.style,
        horizontal = _horizontalExp.test(property),
        isRootSVG = target.tagName.toLowerCase() === "svg",
        measureProperty = (isRootSVG ? "client" : "offset") + (horizontal ? "Width" : "Height"),
        amount = 100,
        toPixels = unit === "px",
        toPercent = unit === "%",
        px,
        parent,
        cache,
        isSVG;

    if (unit === curUnit || !curValue || _nonConvertibleUnits[unit] || _nonConvertibleUnits[curUnit]) {
      return curValue;
    }

    curUnit !== "px" && !toPixels && (curValue = _convertToUnit(target, property, value, "px"));
    isSVG = target.getCTM && _isSVG(target);

    if ((toPercent || curUnit === "%") && (_transformProps[property] || ~property.indexOf("adius"))) {
      px = isSVG ? target.getBBox()[horizontal ? "width" : "height"] : target[measureProperty];
      return _round(toPercent ? curValue / px * amount : curValue / 100 * px);
    }

    style[horizontal ? "width" : "height"] = amount + (toPixels ? curUnit : unit);
    parent = ~property.indexOf("adius") || unit === "em" && target.appendChild && !isRootSVG ? target : target.parentNode;

    if (isSVG) {
      parent = (target.ownerSVGElement || {}).parentNode;
    }

    if (!parent || parent === _doc$1 || !parent.appendChild) {
      parent = _doc$1.body;
    }

    cache = parent._gsap;

    if (cache && toPercent && cache.width && horizontal && cache.time === _ticker.time && !cache.uncache) {
      return _round(curValue / cache.width * amount);
    } else {
      (toPercent || curUnit === "%") && !_nonStandardLayouts[_getComputedProperty(parent, "display")] && (style.position = _getComputedProperty(target, "position"));
      parent === target && (style.position = "static");
      parent.appendChild(_tempDiv);
      px = _tempDiv[measureProperty];
      parent.removeChild(_tempDiv);
      style.position = "absolute";

      if (horizontal && toPercent) {
        cache = _getCache(parent);
        cache.time = _ticker.time;
        cache.width = parent[measureProperty];
      }
    }

    return _round(toPixels ? px * curValue / amount : px && curValue ? amount / px * curValue : 0);
  },
      _get = function _get(target, property, unit, uncache) {
    var value;
    _pluginInitted || _initCore();

    if (property in _propertyAliases && property !== "transform") {
      property = _propertyAliases[property];

      if (~property.indexOf(",")) {
        property = property.split(",")[0];
      }
    }

    if (_transformProps[property] && property !== "transform") {
      value = _parseTransform(target, uncache);
      value = property !== "transformOrigin" ? value[property] : value.svg ? value.origin : _firstTwoOnly(_getComputedProperty(target, _transformOriginProp)) + " " + value.zOrigin + "px";
    } else {
      value = target.style[property];

      if (!value || value === "auto" || uncache || ~(value + "").indexOf("calc(")) {
        value = _specialProps[property] && _specialProps[property](target, property, unit) || _getComputedProperty(target, property) || _getProperty(target, property) || (property === "opacity" ? 1 : 0);
      }
    }

    return unit && !~(value + "").trim().indexOf(" ") ? _convertToUnit(target, property, value, unit) + unit : value;
  },
      _tweenComplexCSSString = function _tweenComplexCSSString(target, prop, start, end) {
    if (!start || start === "none") {
      var p = _checkPropPrefix(prop, target, 1),
          s = p && _getComputedProperty(target, p, 1);

      if (s && s !== start) {
        prop = p;
        start = s;
      } else if (prop === "borderColor") {
        start = _getComputedProperty(target, "borderTopColor");
      }
    }

    var pt = new PropTween(this._pt, target.style, prop, 0, 1, _renderComplexString),
        index = 0,
        matchIndex = 0,
        a,
        result,
        startValues,
        startNum,
        color,
        startValue,
        endValue,
        endNum,
        chunk,
        endUnit,
        startUnit,
        endValues;
    pt.b = start;
    pt.e = end;
    start += "";
    end += "";

    if (end === "auto") {
      target.style[prop] = end;
      end = _getComputedProperty(target, prop) || end;
      target.style[prop] = start;
    }

    a = [start, end];

    _colorStringFilter(a);

    start = a[0];
    end = a[1];
    startValues = start.match(_numWithUnitExp) || [];
    endValues = end.match(_numWithUnitExp) || [];

    if (endValues.length) {
      while (result = _numWithUnitExp.exec(end)) {
        endValue = result[0];
        chunk = end.substring(index, result.index);

        if (color) {
          color = (color + 1) % 5;
        } else if (chunk.substr(-5) === "rgba(" || chunk.substr(-5) === "hsla(") {
          color = 1;
        }

        if (endValue !== (startValue = startValues[matchIndex++] || "")) {
          startNum = parseFloat(startValue) || 0;
          startUnit = startValue.substr((startNum + "").length);
          endValue.charAt(1) === "=" && (endValue = _parseRelative(startNum, endValue) + startUnit);
          endNum = parseFloat(endValue);
          endUnit = endValue.substr((endNum + "").length);
          index = _numWithUnitExp.lastIndex - endUnit.length;

          if (!endUnit) {
            endUnit = endUnit || _config.units[prop] || startUnit;

            if (index === end.length) {
              end += endUnit;
              pt.e += endUnit;
            }
          }

          if (startUnit !== endUnit) {
            startNum = _convertToUnit(target, prop, startValue, endUnit) || 0;
          }

          pt._pt = {
            _next: pt._pt,
            p: chunk || matchIndex === 1 ? chunk : ",",
            s: startNum,
            c: endNum - startNum,
            m: color && color < 4 || prop === "zIndex" ? Math.round : 0
          };
        }
      }

      pt.c = index < end.length ? end.substring(index, end.length) : "";
    } else {
      pt.r = prop === "display" && end === "none" ? _renderNonTweeningValueOnlyAtEnd : _renderNonTweeningValue;
    }

    _relExp.test(end) && (pt.e = 0);
    this._pt = pt;
    return pt;
  },
      _keywordToPercent = {
    top: "0%",
    bottom: "100%",
    left: "0%",
    right: "100%",
    center: "50%"
  },
      _convertKeywordsToPercentages = function _convertKeywordsToPercentages(value) {
    var split = value.split(" "),
        x = split[0],
        y = split[1] || "50%";

    if (x === "top" || x === "bottom" || y === "left" || y === "right") {
      value = x;
      x = y;
      y = value;
    }

    split[0] = _keywordToPercent[x] || x;
    split[1] = _keywordToPercent[y] || y;
    return split.join(" ");
  },
      _renderClearProps = function _renderClearProps(ratio, data) {
    if (data.tween && data.tween._time === data.tween._dur) {
      var target = data.t,
          style = target.style,
          props = data.u,
          cache = target._gsap,
          prop,
          clearTransforms,
          i;

      if (props === "all" || props === true) {
        style.cssText = "";
        clearTransforms = 1;
      } else {
        props = props.split(",");
        i = props.length;

        while (--i > -1) {
          prop = props[i];

          if (_transformProps[prop]) {
            clearTransforms = 1;
            prop = prop === "transformOrigin" ? _transformOriginProp : _transformProp;
          }

          _removeProperty(target, prop);
        }
      }

      if (clearTransforms) {
        _removeProperty(target, _transformProp);

        if (cache) {
          cache.svg && target.removeAttribute("transform");

          _parseTransform(target, 1);

          cache.uncache = 1;

          _removeIndependentTransforms(style);
        }
      }
    }
  },
      _specialProps = {
    clearProps: function clearProps(plugin, target, property, endValue, tween) {
      if (tween.data !== "isFromStart") {
        var pt = plugin._pt = new PropTween(plugin._pt, target, property, 0, 0, _renderClearProps);
        pt.u = endValue;
        pt.pr = -10;
        pt.tween = tween;

        plugin._props.push(property);

        return 1;
      }
    }
  },
      _identity2DMatrix = [1, 0, 0, 1, 0, 0],
      _rotationalProperties = {},
      _isNullTransform = function _isNullTransform(value) {
    return value === "matrix(1, 0, 0, 1, 0, 0)" || value === "none" || !value;
  },
      _getComputedTransformMatrixAsArray = function _getComputedTransformMatrixAsArray(target) {
    var matrixString = _getComputedProperty(target, _transformProp);

    return _isNullTransform(matrixString) ? _identity2DMatrix : matrixString.substr(7).match(_numExp).map(_round);
  },
      _getMatrix = function _getMatrix(target, force2D) {
    var cache = target._gsap || _getCache(target),
        style = target.style,
        matrix = _getComputedTransformMatrixAsArray(target),
        parent,
        nextSibling,
        temp,
        addedToDOM;

    if (cache.svg && target.getAttribute("transform")) {
      temp = target.transform.baseVal.consolidate().matrix;
      matrix = [temp.a, temp.b, temp.c, temp.d, temp.e, temp.f];
      return matrix.join(",") === "1,0,0,1,0,0" ? _identity2DMatrix : matrix;
    } else if (matrix === _identity2DMatrix && !target.offsetParent && target !== _docElement && !cache.svg) {
      temp = style.display;
      style.display = "block";
      parent = target.parentNode;

      if (!parent || !target.offsetParent) {
        addedToDOM = 1;
        nextSibling = target.nextElementSibling;

        _docElement.appendChild(target);
      }

      matrix = _getComputedTransformMatrixAsArray(target);
      temp ? style.display = temp : _removeProperty(target, "display");

      if (addedToDOM) {
        nextSibling ? parent.insertBefore(target, nextSibling) : parent ? parent.appendChild(target) : _docElement.removeChild(target);
      }
    }

    return force2D && matrix.length > 6 ? [matrix[0], matrix[1], matrix[4], matrix[5], matrix[12], matrix[13]] : matrix;
  },
      _applySVGOrigin = function _applySVGOrigin(target, origin, originIsAbsolute, smooth, matrixArray, pluginToAddPropTweensTo) {
    var cache = target._gsap,
        matrix = matrixArray || _getMatrix(target, true),
        xOriginOld = cache.xOrigin || 0,
        yOriginOld = cache.yOrigin || 0,
        xOffsetOld = cache.xOffset || 0,
        yOffsetOld = cache.yOffset || 0,
        a = matrix[0],
        b = matrix[1],
        c = matrix[2],
        d = matrix[3],
        tx = matrix[4],
        ty = matrix[5],
        originSplit = origin.split(" "),
        xOrigin = parseFloat(originSplit[0]) || 0,
        yOrigin = parseFloat(originSplit[1]) || 0,
        bounds,
        determinant,
        x,
        y;

    if (!originIsAbsolute) {
      bounds = _getBBox(target);
      xOrigin = bounds.x + (~originSplit[0].indexOf("%") ? xOrigin / 100 * bounds.width : xOrigin);
      yOrigin = bounds.y + (~(originSplit[1] || originSplit[0]).indexOf("%") ? yOrigin / 100 * bounds.height : yOrigin);
    } else if (matrix !== _identity2DMatrix && (determinant = a * d - b * c)) {
      x = xOrigin * (d / determinant) + yOrigin * (-c / determinant) + (c * ty - d * tx) / determinant;
      y = xOrigin * (-b / determinant) + yOrigin * (a / determinant) - (a * ty - b * tx) / determinant;
      xOrigin = x;
      yOrigin = y;
    }

    if (smooth || smooth !== false && cache.smooth) {
      tx = xOrigin - xOriginOld;
      ty = yOrigin - yOriginOld;
      cache.xOffset = xOffsetOld + (tx * a + ty * c) - tx;
      cache.yOffset = yOffsetOld + (tx * b + ty * d) - ty;
    } else {
      cache.xOffset = cache.yOffset = 0;
    }

    cache.xOrigin = xOrigin;
    cache.yOrigin = yOrigin;
    cache.smooth = !!smooth;
    cache.origin = origin;
    cache.originIsAbsolute = !!originIsAbsolute;
    target.style[_transformOriginProp] = "0px 0px";

    if (pluginToAddPropTweensTo) {
      _addNonTweeningPT(pluginToAddPropTweensTo, cache, "xOrigin", xOriginOld, xOrigin);

      _addNonTweeningPT(pluginToAddPropTweensTo, cache, "yOrigin", yOriginOld, yOrigin);

      _addNonTweeningPT(pluginToAddPropTweensTo, cache, "xOffset", xOffsetOld, cache.xOffset);

      _addNonTweeningPT(pluginToAddPropTweensTo, cache, "yOffset", yOffsetOld, cache.yOffset);
    }

    target.setAttribute("data-svg-origin", xOrigin + " " + yOrigin);
  },
      _parseTransform = function _parseTransform(target, uncache) {
    var cache = target._gsap || new GSCache(target);

    if ("x" in cache && !uncache && !cache.uncache) {
      return cache;
    }

    var style = target.style,
        invertedScaleX = cache.scaleX < 0,
        px = "px",
        deg = "deg",
        cs = getComputedStyle(target),
        origin = _getComputedProperty(target, _transformOriginProp) || "0",
        x,
        y,
        z,
        scaleX,
        scaleY,
        rotation,
        rotationX,
        rotationY,
        skewX,
        skewY,
        perspective,
        xOrigin,
        yOrigin,
        matrix,
        angle,
        cos,
        sin,
        a,
        b,
        c,
        d,
        a12,
        a22,
        t1,
        t2,
        t3,
        a13,
        a23,
        a33,
        a42,
        a43,
        a32;
    x = y = z = rotation = rotationX = rotationY = skewX = skewY = perspective = 0;
    scaleX = scaleY = 1;
    cache.svg = !!(target.getCTM && _isSVG(target));

    if (cs.translate) {
      if (cs.translate !== "none" || cs.scale !== "none" || cs.rotate !== "none") {
        style[_transformProp] = (cs.translate !== "none" ? "translate3d(" + (cs.translate + " 0 0").split(" ").slice(0, 3).join(", ") + ") " : "") + (cs.rotate !== "none" ? "rotate(" + cs.rotate + ") " : "") + (cs.scale !== "none" ? "scale(" + cs.scale.split(" ").join(",") + ") " : "") + (cs[_transformProp] !== "none" ? cs[_transformProp] : "");
      }

      style.scale = style.rotate = style.translate = "none";
    }

    matrix = _getMatrix(target, cache.svg);

    if (cache.svg) {
      if (cache.uncache) {
        t2 = target.getBBox();
        origin = cache.xOrigin - t2.x + "px " + (cache.yOrigin - t2.y) + "px";
        t1 = "";
      } else {
        t1 = !uncache && target.getAttribute("data-svg-origin");
      }

      _applySVGOrigin(target, t1 || origin, !!t1 || cache.originIsAbsolute, cache.smooth !== false, matrix);
    }

    xOrigin = cache.xOrigin || 0;
    yOrigin = cache.yOrigin || 0;

    if (matrix !== _identity2DMatrix) {
      a = matrix[0];
      b = matrix[1];
      c = matrix[2];
      d = matrix[3];
      x = a12 = matrix[4];
      y = a22 = matrix[5];

      if (matrix.length === 6) {
        scaleX = Math.sqrt(a * a + b * b);
        scaleY = Math.sqrt(d * d + c * c);
        rotation = a || b ? _atan2(b, a) * _RAD2DEG : 0;
        skewX = c || d ? _atan2(c, d) * _RAD2DEG + rotation : 0;
        skewX && (scaleY *= Math.abs(Math.cos(skewX * _DEG2RAD)));

        if (cache.svg) {
          x -= xOrigin - (xOrigin * a + yOrigin * c);
          y -= yOrigin - (xOrigin * b + yOrigin * d);
        }
      } else {
        a32 = matrix[6];
        a42 = matrix[7];
        a13 = matrix[8];
        a23 = matrix[9];
        a33 = matrix[10];
        a43 = matrix[11];
        x = matrix[12];
        y = matrix[13];
        z = matrix[14];
        angle = _atan2(a32, a33);
        rotationX = angle * _RAD2DEG;

        if (angle) {
          cos = Math.cos(-angle);
          sin = Math.sin(-angle);
          t1 = a12 * cos + a13 * sin;
          t2 = a22 * cos + a23 * sin;
          t3 = a32 * cos + a33 * sin;
          a13 = a12 * -sin + a13 * cos;
          a23 = a22 * -sin + a23 * cos;
          a33 = a32 * -sin + a33 * cos;
          a43 = a42 * -sin + a43 * cos;
          a12 = t1;
          a22 = t2;
          a32 = t3;
        }

        angle = _atan2(-c, a33);
        rotationY = angle * _RAD2DEG;

        if (angle) {
          cos = Math.cos(-angle);
          sin = Math.sin(-angle);
          t1 = a * cos - a13 * sin;
          t2 = b * cos - a23 * sin;
          t3 = c * cos - a33 * sin;
          a43 = d * sin + a43 * cos;
          a = t1;
          b = t2;
          c = t3;
        }

        angle = _atan2(b, a);
        rotation = angle * _RAD2DEG;

        if (angle) {
          cos = Math.cos(angle);
          sin = Math.sin(angle);
          t1 = a * cos + b * sin;
          t2 = a12 * cos + a22 * sin;
          b = b * cos - a * sin;
          a22 = a22 * cos - a12 * sin;
          a = t1;
          a12 = t2;
        }

        if (rotationX && Math.abs(rotationX) + Math.abs(rotation) > 359.9) {
          rotationX = rotation = 0;
          rotationY = 180 - rotationY;
        }

        scaleX = _round(Math.sqrt(a * a + b * b + c * c));
        scaleY = _round(Math.sqrt(a22 * a22 + a32 * a32));
        angle = _atan2(a12, a22);
        skewX = Math.abs(angle) > 0.0002 ? angle * _RAD2DEG : 0;
        perspective = a43 ? 1 / (a43 < 0 ? -a43 : a43) : 0;
      }

      if (cache.svg) {
        t1 = target.getAttribute("transform");
        cache.forceCSS = target.setAttribute("transform", "") || !_isNullTransform(_getComputedProperty(target, _transformProp));
        t1 && target.setAttribute("transform", t1);
      }
    }

    if (Math.abs(skewX) > 90 && Math.abs(skewX) < 270) {
      if (invertedScaleX) {
        scaleX *= -1;
        skewX += rotation <= 0 ? 180 : -180;
        rotation += rotation <= 0 ? 180 : -180;
      } else {
        scaleY *= -1;
        skewX += skewX <= 0 ? 180 : -180;
      }
    }

    uncache = uncache || cache.uncache;
    cache.x = x - ((cache.xPercent = x && (!uncache && cache.xPercent || (Math.round(target.offsetWidth / 2) === Math.round(-x) ? -50 : 0))) ? target.offsetWidth * cache.xPercent / 100 : 0) + px;
    cache.y = y - ((cache.yPercent = y && (!uncache && cache.yPercent || (Math.round(target.offsetHeight / 2) === Math.round(-y) ? -50 : 0))) ? target.offsetHeight * cache.yPercent / 100 : 0) + px;
    cache.z = z + px;
    cache.scaleX = _round(scaleX);
    cache.scaleY = _round(scaleY);
    cache.rotation = _round(rotation) + deg;
    cache.rotationX = _round(rotationX) + deg;
    cache.rotationY = _round(rotationY) + deg;
    cache.skewX = skewX + deg;
    cache.skewY = skewY + deg;
    cache.transformPerspective = perspective + px;

    if (cache.zOrigin = parseFloat(origin.split(" ")[2]) || 0) {
      style[_transformOriginProp] = _firstTwoOnly(origin);
    }

    cache.xOffset = cache.yOffset = 0;
    cache.force3D = _config.force3D;
    cache.renderTransform = cache.svg ? _renderSVGTransforms : _supports3D ? _renderCSSTransforms : _renderNon3DTransforms;
    cache.uncache = 0;
    return cache;
  },
      _firstTwoOnly = function _firstTwoOnly(value) {
    return (value = value.split(" "))[0] + " " + value[1];
  },
      _addPxTranslate = function _addPxTranslate(target, start, value) {
    var unit = getUnit(start);
    return _round(parseFloat(start) + parseFloat(_convertToUnit(target, "x", value + "px", unit))) + unit;
  },
      _renderNon3DTransforms = function _renderNon3DTransforms(ratio, cache) {
    cache.z = "0px";
    cache.rotationY = cache.rotationX = "0deg";
    cache.force3D = 0;

    _renderCSSTransforms(ratio, cache);
  },
      _zeroDeg = "0deg",
      _zeroPx = "0px",
      _endParenthesis = ") ",
      _renderCSSTransforms = function _renderCSSTransforms(ratio, cache) {
    var _ref = cache || this,
        xPercent = _ref.xPercent,
        yPercent = _ref.yPercent,
        x = _ref.x,
        y = _ref.y,
        z = _ref.z,
        rotation = _ref.rotation,
        rotationY = _ref.rotationY,
        rotationX = _ref.rotationX,
        skewX = _ref.skewX,
        skewY = _ref.skewY,
        scaleX = _ref.scaleX,
        scaleY = _ref.scaleY,
        transformPerspective = _ref.transformPerspective,
        force3D = _ref.force3D,
        target = _ref.target,
        zOrigin = _ref.zOrigin,
        transforms = "",
        use3D = force3D === "auto" && ratio && ratio !== 1 || force3D === true;

    if (zOrigin && (rotationX !== _zeroDeg || rotationY !== _zeroDeg)) {
      var angle = parseFloat(rotationY) * _DEG2RAD,
          a13 = Math.sin(angle),
          a33 = Math.cos(angle),
          cos;

      angle = parseFloat(rotationX) * _DEG2RAD;
      cos = Math.cos(angle);
      x = _addPxTranslate(target, x, a13 * cos * -zOrigin);
      y = _addPxTranslate(target, y, -Math.sin(angle) * -zOrigin);
      z = _addPxTranslate(target, z, a33 * cos * -zOrigin + zOrigin);
    }

    if (transformPerspective !== _zeroPx) {
      transforms += "perspective(" + transformPerspective + _endParenthesis;
    }

    if (xPercent || yPercent) {
      transforms += "translate(" + xPercent + "%, " + yPercent + "%) ";
    }

    if (use3D || x !== _zeroPx || y !== _zeroPx || z !== _zeroPx) {
      transforms += z !== _zeroPx || use3D ? "translate3d(" + x + ", " + y + ", " + z + ") " : "translate(" + x + ", " + y + _endParenthesis;
    }

    if (rotation !== _zeroDeg) {
      transforms += "rotate(" + rotation + _endParenthesis;
    }

    if (rotationY !== _zeroDeg) {
      transforms += "rotateY(" + rotationY + _endParenthesis;
    }

    if (rotationX !== _zeroDeg) {
      transforms += "rotateX(" + rotationX + _endParenthesis;
    }

    if (skewX !== _zeroDeg || skewY !== _zeroDeg) {
      transforms += "skew(" + skewX + ", " + skewY + _endParenthesis;
    }

    if (scaleX !== 1 || scaleY !== 1) {
      transforms += "scale(" + scaleX + ", " + scaleY + _endParenthesis;
    }

    target.style[_transformProp] = transforms || "translate(0, 0)";
  },
      _renderSVGTransforms = function _renderSVGTransforms(ratio, cache) {
    var _ref2 = cache || this,
        xPercent = _ref2.xPercent,
        yPercent = _ref2.yPercent,
        x = _ref2.x,
        y = _ref2.y,
        rotation = _ref2.rotation,
        skewX = _ref2.skewX,
        skewY = _ref2.skewY,
        scaleX = _ref2.scaleX,
        scaleY = _ref2.scaleY,
        target = _ref2.target,
        xOrigin = _ref2.xOrigin,
        yOrigin = _ref2.yOrigin,
        xOffset = _ref2.xOffset,
        yOffset = _ref2.yOffset,
        forceCSS = _ref2.forceCSS,
        tx = parseFloat(x),
        ty = parseFloat(y),
        a11,
        a21,
        a12,
        a22,
        temp;

    rotation = parseFloat(rotation);
    skewX = parseFloat(skewX);
    skewY = parseFloat(skewY);

    if (skewY) {
      skewY = parseFloat(skewY);
      skewX += skewY;
      rotation += skewY;
    }

    if (rotation || skewX) {
      rotation *= _DEG2RAD;
      skewX *= _DEG2RAD;
      a11 = Math.cos(rotation) * scaleX;
      a21 = Math.sin(rotation) * scaleX;
      a12 = Math.sin(rotation - skewX) * -scaleY;
      a22 = Math.cos(rotation - skewX) * scaleY;

      if (skewX) {
        skewY *= _DEG2RAD;
        temp = Math.tan(skewX - skewY);
        temp = Math.sqrt(1 + temp * temp);
        a12 *= temp;
        a22 *= temp;

        if (skewY) {
          temp = Math.tan(skewY);
          temp = Math.sqrt(1 + temp * temp);
          a11 *= temp;
          a21 *= temp;
        }
      }

      a11 = _round(a11);
      a21 = _round(a21);
      a12 = _round(a12);
      a22 = _round(a22);
    } else {
      a11 = scaleX;
      a22 = scaleY;
      a21 = a12 = 0;
    }

    if (tx && !~(x + "").indexOf("px") || ty && !~(y + "").indexOf("px")) {
      tx = _convertToUnit(target, "x", x, "px");
      ty = _convertToUnit(target, "y", y, "px");
    }

    if (xOrigin || yOrigin || xOffset || yOffset) {
      tx = _round(tx + xOrigin - (xOrigin * a11 + yOrigin * a12) + xOffset);
      ty = _round(ty + yOrigin - (xOrigin * a21 + yOrigin * a22) + yOffset);
    }

    if (xPercent || yPercent) {
      temp = target.getBBox();
      tx = _round(tx + xPercent / 100 * temp.width);
      ty = _round(ty + yPercent / 100 * temp.height);
    }

    temp = "matrix(" + a11 + "," + a21 + "," + a12 + "," + a22 + "," + tx + "," + ty + ")";
    target.setAttribute("transform", temp);
    forceCSS && (target.style[_transformProp] = temp);
  },
      _addRotationalPropTween = function _addRotationalPropTween(plugin, target, property, startNum, endValue) {
    var cap = 360,
        isString = _isString(endValue),
        endNum = parseFloat(endValue) * (isString && ~endValue.indexOf("rad") ? _RAD2DEG : 1),
        change = endNum - startNum,
        finalValue = startNum + change + "deg",
        direction,
        pt;

    if (isString) {
      direction = endValue.split("_")[1];

      if (direction === "short") {
        change %= cap;

        if (change !== change % (cap / 2)) {
          change += change < 0 ? cap : -cap;
        }
      }

      if (direction === "cw" && change < 0) {
        change = (change + cap * _bigNum$1) % cap - ~~(change / cap) * cap;
      } else if (direction === "ccw" && change > 0) {
        change = (change - cap * _bigNum$1) % cap - ~~(change / cap) * cap;
      }
    }

    plugin._pt = pt = new PropTween(plugin._pt, target, property, startNum, change, _renderPropWithEnd);
    pt.e = finalValue;
    pt.u = "deg";

    plugin._props.push(property);

    return pt;
  },
      _assign = function _assign(target, source) {
    for (var p in source) {
      target[p] = source[p];
    }

    return target;
  },
      _addRawTransformPTs = function _addRawTransformPTs(plugin, transforms, target) {
    var startCache = _assign({}, target._gsap),
        exclude = "perspective,force3D,transformOrigin,svgOrigin",
        style = target.style,
        endCache,
        p,
        startValue,
        endValue,
        startNum,
        endNum,
        startUnit,
        endUnit;

    if (startCache.svg) {
      startValue = target.getAttribute("transform");
      target.setAttribute("transform", "");
      style[_transformProp] = transforms;
      endCache = _parseTransform(target, 1);

      _removeProperty(target, _transformProp);

      target.setAttribute("transform", startValue);
    } else {
      startValue = getComputedStyle(target)[_transformProp];
      style[_transformProp] = transforms;
      endCache = _parseTransform(target, 1);
      style[_transformProp] = startValue;
    }

    for (p in _transformProps) {
      startValue = startCache[p];
      endValue = endCache[p];

      if (startValue !== endValue && exclude.indexOf(p) < 0) {
        startUnit = getUnit(startValue);
        endUnit = getUnit(endValue);
        startNum = startUnit !== endUnit ? _convertToUnit(target, p, startValue, endUnit) : parseFloat(startValue);
        endNum = parseFloat(endValue);
        plugin._pt = new PropTween(plugin._pt, endCache, p, startNum, endNum - startNum, _renderCSSProp);
        plugin._pt.u = endUnit || 0;

        plugin._props.push(p);
      }
    }

    _assign(endCache, startCache);
  };

  _forEachName("padding,margin,Width,Radius", function (name, index) {
    var t = "Top",
        r = "Right",
        b = "Bottom",
        l = "Left",
        props = (index < 3 ? [t, r, b, l] : [t + l, t + r, b + r, b + l]).map(function (side) {
      return index < 2 ? name + side : "border" + side + name;
    });

    _specialProps[index > 1 ? "border" + name : name] = function (plugin, target, property, endValue, tween) {
      var a, vars;

      if (arguments.length < 4) {
        a = props.map(function (prop) {
          return _get(plugin, prop, property);
        });
        vars = a.join(" ");
        return vars.split(a[0]).length === 5 ? a[0] : vars;
      }

      a = (endValue + "").split(" ");
      vars = {};
      props.forEach(function (prop, i) {
        return vars[prop] = a[i] = a[i] || a[(i - 1) / 2 | 0];
      });
      plugin.init(target, vars, tween);
    };
  });

  var CSSPlugin = {
    name: "css",
    register: _initCore,
    targetTest: function targetTest(target) {
      return target.style && target.nodeType;
    },
    init: function init(target, vars, tween, index, targets) {
      var props = this._props,
          style = target.style,
          startAt = tween.vars.startAt,
          startValue,
          endValue,
          endNum,
          startNum,
          type,
          specialProp,
          p,
          startUnit,
          endUnit,
          relative,
          isTransformRelated,
          transformPropTween,
          cache,
          smooth,
          hasPriority,
          inlineProps;
      _pluginInitted || _initCore();
      this.styles = this.styles || _getStyleSaver(target);
      inlineProps = this.styles.props;
      this.tween = tween;

      for (p in vars) {
        if (p === "autoRound") {
          continue;
        }

        endValue = vars[p];

        if (_plugins[p] && _checkPlugin(p, vars, tween, index, target, targets)) {
          continue;
        }

        type = typeof endValue;
        specialProp = _specialProps[p];

        if (type === "function") {
          endValue = endValue.call(tween, index, target, targets);
          type = typeof endValue;
        }

        if (type === "string" && ~endValue.indexOf("random(")) {
          endValue = _replaceRandom(endValue);
        }

        if (specialProp) {
          specialProp(this, target, p, endValue, tween) && (hasPriority = 1);
        } else if (p.substr(0, 2) === "--") {
          startValue = (getComputedStyle(target).getPropertyValue(p) + "").trim();
          endValue += "";
          _colorExp.lastIndex = 0;

          if (!_colorExp.test(startValue)) {
            startUnit = getUnit(startValue);
            endUnit = getUnit(endValue);
          }

          endUnit ? startUnit !== endUnit && (startValue = _convertToUnit(target, p, startValue, endUnit) + endUnit) : startUnit && (endValue += startUnit);
          this.add(style, "setProperty", startValue, endValue, index, targets, 0, 0, p);
          props.push(p);
          inlineProps.push(p, 0, style[p]);
        } else if (type !== "undefined") {
          if (startAt && p in startAt) {
            startValue = typeof startAt[p] === "function" ? startAt[p].call(tween, index, target, targets) : startAt[p];
            _isString(startValue) && ~startValue.indexOf("random(") && (startValue = _replaceRandom(startValue));
            getUnit(startValue + "") || (startValue += _config.units[p] || getUnit(_get(target, p)) || "");
            (startValue + "").charAt(1) === "=" && (startValue = _get(target, p));
          } else {
            startValue = _get(target, p);
          }

          startNum = parseFloat(startValue);
          relative = type === "string" && endValue.charAt(1) === "=" && endValue.substr(0, 2);
          relative && (endValue = endValue.substr(2));
          endNum = parseFloat(endValue);

          if (p in _propertyAliases) {
            if (p === "autoAlpha") {
              if (startNum === 1 && _get(target, "visibility") === "hidden" && endNum) {
                startNum = 0;
              }

              inlineProps.push("visibility", 0, style.visibility);

              _addNonTweeningPT(this, style, "visibility", startNum ? "inherit" : "hidden", endNum ? "inherit" : "hidden", !endNum);
            }

            if (p !== "scale" && p !== "transform") {
              p = _propertyAliases[p];
              ~p.indexOf(",") && (p = p.split(",")[0]);
            }
          }

          isTransformRelated = p in _transformProps;

          if (isTransformRelated) {
            this.styles.save(p);

            if (!transformPropTween) {
              cache = target._gsap;
              cache.renderTransform && !vars.parseTransform || _parseTransform(target, vars.parseTransform);
              smooth = vars.smoothOrigin !== false && cache.smooth;
              transformPropTween = this._pt = new PropTween(this._pt, style, _transformProp, 0, 1, cache.renderTransform, cache, 0, -1);
              transformPropTween.dep = 1;
            }

            if (p === "scale") {
              this._pt = new PropTween(this._pt, cache, "scaleY", startNum, (relative ? _parseRelative(startNum, relative + endNum) : endNum) - startNum || 0, _renderCSSProp);
              this._pt.u = 0;
              props.push("scaleY", p);
              p += "X";
            } else if (p === "transformOrigin") {
              inlineProps.push(_transformOriginProp, 0, style[_transformOriginProp]);
              endValue = _convertKeywordsToPercentages(endValue);

              if (cache.svg) {
                _applySVGOrigin(target, endValue, 0, smooth, 0, this);
              } else {
                endUnit = parseFloat(endValue.split(" ")[2]) || 0;
                endUnit !== cache.zOrigin && _addNonTweeningPT(this, cache, "zOrigin", cache.zOrigin, endUnit);

                _addNonTweeningPT(this, style, p, _firstTwoOnly(startValue), _firstTwoOnly(endValue));
              }

              continue;
            } else if (p === "svgOrigin") {
              _applySVGOrigin(target, endValue, 1, smooth, 0, this);

              continue;
            } else if (p in _rotationalProperties) {
              _addRotationalPropTween(this, cache, p, startNum, relative ? _parseRelative(startNum, relative + endValue) : endValue);

              continue;
            } else if (p === "smoothOrigin") {
              _addNonTweeningPT(this, cache, "smooth", cache.smooth, endValue);

              continue;
            } else if (p === "force3D") {
              cache[p] = endValue;
              continue;
            } else if (p === "transform") {
              _addRawTransformPTs(this, endValue, target);

              continue;
            }
          } else if (!(p in style)) {
            p = _checkPropPrefix(p) || p;
          }

          if (isTransformRelated || (endNum || endNum === 0) && (startNum || startNum === 0) && !_complexExp.test(endValue) && p in style) {
            startUnit = (startValue + "").substr((startNum + "").length);
            endNum || (endNum = 0);
            endUnit = getUnit(endValue) || (p in _config.units ? _config.units[p] : startUnit);
            startUnit !== endUnit && (startNum = _convertToUnit(target, p, startValue, endUnit));
            this._pt = new PropTween(this._pt, isTransformRelated ? cache : style, p, startNum, (relative ? _parseRelative(startNum, relative + endNum) : endNum) - startNum, !isTransformRelated && (endUnit === "px" || p === "zIndex") && vars.autoRound !== false ? _renderRoundedCSSProp : _renderCSSProp);
            this._pt.u = endUnit || 0;

            if (startUnit !== endUnit && endUnit !== "%") {
              this._pt.b = startValue;
              this._pt.r = _renderCSSPropWithBeginning;
            }
          } else if (!(p in style)) {
            if (p in target) {
              this.add(target, p, startValue || target[p], relative ? relative + endValue : endValue, index, targets);
            } else {
              _missingPlugin(p, endValue);

              continue;
            }
          } else {
            _tweenComplexCSSString.call(this, target, p, startValue, relative ? relative + endValue : endValue);
          }

          isTransformRelated || (p in style ? inlineProps.push(p, 0, style[p]) : inlineProps.push(p, 1, startValue || target[p]));
          props.push(p);
        }
      }

      hasPriority && _sortPropTweensByPriority(this);
    },
    render: function render(ratio, data) {
      if (data.tween._time || !_reverting$1()) {
        var pt = data._pt;

        while (pt) {
          pt.r(ratio, pt.d);
          pt = pt._next;
        }
      } else {
        data.styles.revert();
      }
    },
    get: _get,
    aliases: _propertyAliases,
    getSetter: function getSetter(target, property, plugin) {
      var p = _propertyAliases[property];
      p && p.indexOf(",") < 0 && (property = p);
      return property in _transformProps && property !== _transformOriginProp && (target._gsap.x || _get(target, "x")) ? plugin && _recentSetterPlugin === plugin ? property === "scale" ? _setterScale : _setterTransform : (_recentSetterPlugin = plugin || {}) && (property === "scale" ? _setterScaleWithRender : _setterTransformWithRender) : target.style && !_isUndefined(target.style[property]) ? _setterCSSStyle : ~property.indexOf("-") ? _setterCSSProp : _getSetter(target, property);
    },
    core: {
      _removeProperty: _removeProperty,
      _getMatrix: _getMatrix
    }
  };
  gsap.utils.checkPrefix = _checkPropPrefix;
  gsap.core.getStyleSaver = _getStyleSaver;

  (function (positionAndScale, rotation, others, aliases) {
    var all = _forEachName(positionAndScale + "," + rotation + "," + others, function (name) {
      _transformProps[name] = 1;
    });

    _forEachName(rotation, function (name) {
      _config.units[name] = "deg";
      _rotationalProperties[name] = 1;
    });

    _propertyAliases[all[13]] = positionAndScale + "," + rotation;

    _forEachName(aliases, function (name) {
      var split = name.split(":");
      _propertyAliases[split[1]] = all[split[0]];
    });
  })("x,y,z,scale,scaleX,scaleY,xPercent,yPercent", "rotation,rotationX,rotationY,skewX,skewY", "transform,transformOrigin,svgOrigin,force3D,smoothOrigin,transformPerspective", "0:translateX,1:translateY,2:translateZ,8:rotate,8:rotationZ,8:rotateZ,9:rotateX,10:rotateY");

  _forEachName("x,y,z,top,right,bottom,left,width,height,fontSize,padding,margin,perspective", function (name) {
    _config.units[name] = "px";
  });

  gsap.registerPlugin(CSSPlugin);

  var gsapWithCSS = gsap.registerPlugin(CSSPlugin) || gsap,
      TweenMaxWithCSS = gsapWithCSS.core.Tween;

  exports.Back = Back;
  exports.Bounce = Bounce;
  exports.CSSPlugin = CSSPlugin;
  exports.Circ = Circ;
  exports.Cubic = Cubic;
  exports.Elastic = Elastic;
  exports.Expo = Expo;
  exports.Linear = Linear;
  exports.Power0 = Power0;
  exports.Power1 = Power1;
  exports.Power2 = Power2;
  exports.Power3 = Power3;
  exports.Power4 = Power4;
  exports.Quad = Quad;
  exports.Quart = Quart;
  exports.Quint = Quint;
  exports.Sine = Sine;
  exports.SteppedEase = SteppedEase;
  exports.Strong = Strong;
  exports.TimelineLite = Timeline;
  exports.TimelineMax = Timeline;
  exports.TweenLite = Tween;
  exports.TweenMax = TweenMaxWithCSS;
  exports.default = gsapWithCSS;
  exports.gsap = gsapWithCSS;

  if (typeof(window) === 'undefined' || window !== exports) {Object.defineProperty(exports, '__esModule', { value: true });} else {delete window.default;}

})));

/*!
 * headroom.js v0.12.0 - Give your page some headroom. Hide your header until you need it
 * Copyright (c) 2020 Nick Williams - http://wicky.nillia.ms/headroom.js
 * License: MIT
 */

!(function (t, n) {
  "object" == typeof exports && "undefined" != typeof module ? (module.exports = n()) : "function" == typeof define && define.amd ? define(n) : ((t = t || self).Headroom = n());
})(this, function () {
  "use strict";
  function t() {
    return "undefined" != typeof window;
  }
  function d(t) {
    return (function (t) {
      return (
        t &&
        t.document &&
        (function (t) {
          return 9 === t.nodeType;
        })(t.document)
      );
    })(t)
      ? (function (t) {
          var n = t.document,
            o = n.body,
            s = n.documentElement;
          return {
            scrollHeight: function () {
              return Math.max(o.scrollHeight, s.scrollHeight, o.offsetHeight, s.offsetHeight, o.clientHeight, s.clientHeight);
            },
            height: function () {
              return t.innerHeight || s.clientHeight || o.clientHeight;
            },
            scrollY: function () {
              return void 0 !== t.pageYOffset ? t.pageYOffset : (s || o.parentNode || o).scrollTop;
            },
          };
        })(t)
      : (function (t) {
          return {
            scrollHeight: function () {
              return Math.max(t.scrollHeight, t.offsetHeight, t.clientHeight);
            },
            height: function () {
              return Math.max(t.offsetHeight, t.clientHeight);
            },
            scrollY: function () {
              return t.scrollTop;
            },
          };
        })(t);
  }
  function n(t, s, e) {
    var n,
      o = (function () {
        var n = !1;
        try {
          var t = {
            get passive() {
              n = !0;
            },
          };
          window.addEventListener("test", t, t), window.removeEventListener("test", t, t);
        } catch (t) {
          n = !1;
        }
        return n;
      })(),
      i = !1,
      r = d(t),
      l = r.scrollY(),
      a = {};
    function c() {
      var t = Math.round(r.scrollY()),
        n = r.height(),
        o = r.scrollHeight();
      (a.scrollY = t), (a.lastScrollY = l), (a.direction = l < t ? "down" : "up"), (a.distance = Math.abs(t - l)), (a.isOutOfBounds = t < 0 || o < t + n), (a.top = t <= s.offset[a.direction]), (a.bottom = o <= t + n), (a.toleranceExceeded = a.distance > s.tolerance[a.direction]), e(a), (l = t), (i = !1);
    }
    function h() {
      i || ((i = !0), (n = requestAnimationFrame(c)));
    }
    var u = !!o && { passive: !0, capture: !1 };
    return (
      t.addEventListener("scroll", h, u),
      c(),
      {
        destroy: function () {
          cancelAnimationFrame(n), t.removeEventListener("scroll", h, u);
        },
      }
    );
  }
  function o(t) {
    return t === Object(t) ? t : { down: t, up: t };
  }
  function s(t, n) {
    (n = n || {}), Object.assign(this, s.options, n), (this.classes = Object.assign({}, s.options.classes, n.classes)), (this.elem = t), (this.tolerance = o(this.tolerance)), (this.offset = o(this.offset)), (this.initialised = !1), (this.frozen = !1);
  }
  return (
    (s.prototype = {
      constructor: s,
      init: function () {
        return (
          s.cutsTheMustard &&
            !this.initialised &&
            (this.addClass("initial"),
            (this.initialised = !0),
            setTimeout(
              function (t) {
                t.scrollTracker = n(t.scroller, { offset: t.offset, tolerance: t.tolerance }, t.update.bind(t));
              },
              100,
              this
            )),
          this
        );
      },
      destroy: function () {
        (this.initialised = !1), Object.keys(this.classes).forEach(this.removeClass, this), this.scrollTracker.destroy();
      },
      unpin: function () {
        (!this.hasClass("pinned") && this.hasClass("unpinned")) || (this.addClass("unpinned"), this.removeClass("pinned"), this.onUnpin && this.onUnpin.call(this));
      },
      pin: function () {
        this.hasClass("unpinned") && (this.addClass("pinned"), this.removeClass("unpinned"), this.onPin && this.onPin.call(this));
      },
      freeze: function () {
        (this.frozen = !0), this.addClass("frozen");
      },
      unfreeze: function () {
        (this.frozen = !1), this.removeClass("frozen");
      },
      top: function () {
        this.hasClass("top") || (this.addClass("top"), this.removeClass("notTop"), this.onTop && this.onTop.call(this));
      },
      notTop: function () {
        this.hasClass("notTop") || (this.addClass("notTop"), this.removeClass("top"), this.onNotTop && this.onNotTop.call(this));
      },
      bottom: function () {
        this.hasClass("bottom") || (this.addClass("bottom"), this.removeClass("notBottom"), this.onBottom && this.onBottom.call(this));
      },
      notBottom: function () {
        this.hasClass("notBottom") || (this.addClass("notBottom"), this.removeClass("bottom"), this.onNotBottom && this.onNotBottom.call(this));
      },
      shouldUnpin: function (t) {
        return "down" === t.direction && !t.top && t.toleranceExceeded;
      },
      shouldPin: function (t) {
        return ("up" === t.direction && t.toleranceExceeded) || t.top;
      },
      addClass: function (t) {
        this.elem.classList.add.apply(this.elem.classList, this.classes[t].split(" "));
      },
      removeClass: function (t) {
        this.elem.classList.remove.apply(this.elem.classList, this.classes[t].split(" "));
      },
      hasClass: function (t) {
        return this.classes[t].split(" ").every(function (t) {
          return this.classList.contains(t);
        }, this.elem);
      },
      update: function (t) {
        t.isOutOfBounds || (!0 !== this.frozen && (t.top ? this.top() : this.notTop(), t.bottom ? this.bottom() : this.notBottom(), this.shouldUnpin(t) ? this.unpin() : this.shouldPin(t) && this.pin()));
      },
    }),
    (s.options = { tolerance: { up: 0, down: 0 }, offset: 0, scroller: t() ? window : null, classes: { frozen: "headroom--frozen", pinned: "headroom--pinned", unpinned: "headroom--unpinned", top: "headroom--top", notTop: "headroom--not-top", bottom: "headroom--bottom", notBottom: "headroom--not-bottom", initial: "headroom" } }),
    (s.cutsTheMustard = !!(t() && function () {}.bind && "classList" in document.documentElement && Object.assign && Object.keys && requestAnimationFrame)),
    s
  );
});

function t(t, e, i) {
  return Math.max(t, Math.min(e, i));
}
var e = class {
  isRunning = !1;
  value = 0;
  from = 0;
  to = 0;
  currentTime = 0;
  lerp;
  duration;
  easing;
  onUpdate;
  advance(e) {
    if (!this.isRunning) return;
    let i = !1;
    if (this.duration && this.easing) {
      this.currentTime += e;
      const s = t(0, this.currentTime / this.duration, 1);
      i = s >= 1;
      const o = i ? 1 : this.easing(s);
      this.value = this.from + (this.to - this.from) * o;
    } else
      this.lerp
        ? ((this.value = (function (t, e, i, s) {
            return (function (t, e, i) {
              return (1 - i) * t + i * e;
            })(t, e, 1 - Math.exp(-i * s));
          })(this.value, this.to, 60 * this.lerp, e)),
          Math.round(this.value) === this.to && ((this.value = this.to), (i = !0)))
        : ((this.value = this.to), (i = !0));
    i && this.stop(), this.onUpdate?.(this.value, i);
  }
  stop() {
    this.isRunning = !1;
  }
  fromTo(t, e, { lerp: i, duration: s, easing: o, onStart: n, onUpdate: r }) {
    (this.from = this.value = t), (this.to = e), (this.lerp = i), (this.duration = s), (this.easing = o), (this.currentTime = 0), (this.isRunning = !0), n?.(), (this.onUpdate = r);
  }
};
var i = class {
    constructor(t, e, { autoResize: i = !0, debounce: s = 250 } = {}) {
      (this.wrapper = t),
        (this.content = e),
        i &&
          ((this.debouncedResize = (function (t, e) {
            let i;
            return function (...s) {
              let o = this;
              clearTimeout(i),
                (i = setTimeout(() => {
                  (i = void 0), t.apply(o, s);
                }, e));
            };
          })(this.resize, s)),
          this.wrapper instanceof Window ? window.addEventListener("resize", this.debouncedResize, !1) : ((this.wrapperResizeObserver = new ResizeObserver(this.debouncedResize)), this.wrapperResizeObserver.observe(this.wrapper)),
          (this.contentResizeObserver = new ResizeObserver(this.debouncedResize)),
          this.contentResizeObserver.observe(this.content)),
        this.resize();
    }
    width = 0;
    height = 0;
    scrollHeight = 0;
    scrollWidth = 0;
    debouncedResize;
    wrapperResizeObserver;
    contentResizeObserver;
    destroy() {
      this.wrapperResizeObserver?.disconnect(), this.contentResizeObserver?.disconnect(), this.wrapper === window && this.debouncedResize && window.removeEventListener("resize", this.debouncedResize, !1);
    }
    resize = () => {
      this.onWrapperResize(), this.onContentResize();
    };
    onWrapperResize = () => {
      this.wrapper instanceof Window ? ((this.width = window.innerWidth), (this.height = window.innerHeight)) : ((this.width = this.wrapper.clientWidth), (this.height = this.wrapper.clientHeight));
    };
    onContentResize = () => {
      this.wrapper instanceof Window ? ((this.scrollHeight = this.content.scrollHeight), (this.scrollWidth = this.content.scrollWidth)) : ((this.scrollHeight = this.wrapper.scrollHeight), (this.scrollWidth = this.wrapper.scrollWidth));
    };
    get limit() {
      return { x: this.scrollWidth - this.width, y: this.scrollHeight - this.height };
    }
  },
  s = class {
    events = {};
    emit(t, ...e) {
      let i = this.events[t] || [];
      for (let t = 0, s = i.length; t < s; t++) i[t]?.(...e);
    }
    on(t, e) {
      return (
        this.events[t]?.push(e) || (this.events[t] = [e]),
        () => {
          this.events[t] = this.events[t]?.filter((t) => e !== t);
        }
      );
    }
    off(t, e) {
      this.events[t] = this.events[t]?.filter((t) => e !== t);
    }
    destroy() {
      this.events = {};
    }
  },
  o = 100 / 6,
  n = { passive: !1 },
  r = class {
    constructor(t, e = { wheelMultiplier: 1, touchMultiplier: 1 }) {
      (this.element = t), (this.options = e), window.addEventListener("resize", this.onWindowResize, !1), this.onWindowResize(), this.element.addEventListener("wheel", this.onWheel, n), this.element.addEventListener("touchstart", this.onTouchStart, n), this.element.addEventListener("touchmove", this.onTouchMove, n), this.element.addEventListener("touchend", this.onTouchEnd, n);
    }
    touchStart = { x: 0, y: 0 };
    lastDelta = { x: 0, y: 0 };
    window = { width: 0, height: 0 };
    emitter = new s();
    on(t, e) {
      return this.emitter.on(t, e);
    }
    destroy() {
      this.emitter.destroy(), window.removeEventListener("resize", this.onWindowResize, !1), this.element.removeEventListener("wheel", this.onWheel, n), this.element.removeEventListener("touchstart", this.onTouchStart, n), this.element.removeEventListener("touchmove", this.onTouchMove, n), this.element.removeEventListener("touchend", this.onTouchEnd, n);
    }
    onTouchStart = (t) => {
      const { clientX: e, clientY: i } = t.targetTouches ? t.targetTouches[0] : t;
      (this.touchStart.x = e), (this.touchStart.y = i), (this.lastDelta = { x: 0, y: 0 }), this.emitter.emit("scroll", { deltaX: 0, deltaY: 0, event: t });
    };
    onTouchMove = (t) => {
      const { clientX: e, clientY: i } = t.targetTouches ? t.targetTouches[0] : t,
        s = -(e - this.touchStart.x) * this.options.touchMultiplier,
        o = -(i - this.touchStart.y) * this.options.touchMultiplier;
      (this.touchStart.x = e), (this.touchStart.y = i), (this.lastDelta = { x: s, y: o }), this.emitter.emit("scroll", { deltaX: s, deltaY: o, event: t });
    };
    onTouchEnd = (t) => {
      this.emitter.emit("scroll", { deltaX: this.lastDelta.x, deltaY: this.lastDelta.y, event: t });
    };
    onWheel = (t) => {
      let { deltaX: e, deltaY: i, deltaMode: s } = t;
      (e *= 1 === s ? o : 2 === s ? this.window.width : 1), (i *= 1 === s ? o : 2 === s ? this.window.height : 1), (e *= this.options.wheelMultiplier), (i *= this.options.wheelMultiplier), this.emitter.emit("scroll", { deltaX: e, deltaY: i, event: t });
    };
    onWindowResize = () => {
      this.window = { width: window.innerWidth, height: window.innerHeight };
    };
  },
  Lenis = class {
    _isScrolling = !1;
    _isStopped = !1;
    _isLocked = !1;
    _preventNextNativeScrollEvent = !1;
    _resetVelocityTimeout = null;
    __rafID = null;
    isTouching;
    time = 0;
    userData = {};
    lastVelocity = 0;
    velocity = 0;
    direction = 0;
    options;
    targetScroll;
    animatedScroll;
    animate = new e();
    emitter = new s();
    dimensions;
    virtualScroll;
    constructor({
      wrapper: t = window,
      content: e = document.documentElement,
      eventsTarget: s = t,
      smoothWheel: o = !0,
      syncTouch: n = !1,
      syncTouchLerp: l = 0.075,
      touchInertiaMultiplier: h = 35,
      duration: a,
      easing: c = (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      lerp: p = 0.1,
      infinite: d = !1,
      orientation: u = "vertical",
      gestureOrientation: m = "vertical",
      touchMultiplier: v = 1,
      wheelMultiplier: g = 1,
      autoResize: w = !0,
      prevent: S,
      virtualScroll: f,
      overscroll: y = !0,
      autoRaf: E = !1,
      anchors: T = !1,
      autoToggle: z = !1,
      allowNestedScroll: b = !1,
      __experimental__naiveDimensions: _ = !1,
    } = {}) {
      (window.lenisVersion = "1.3.1"),
        (t && t !== document.documentElement) || (t = window),
        (this.options = { wrapper: t, content: e, eventsTarget: s, smoothWheel: o, syncTouch: n, syncTouchLerp: l, touchInertiaMultiplier: h, duration: a, easing: c, lerp: p, infinite: d, gestureOrientation: m, orientation: u, touchMultiplier: v, wheelMultiplier: g, autoResize: w, prevent: S, virtualScroll: f, overscroll: y, autoRaf: E, anchors: T, autoToggle: z, allowNestedScroll: b, __experimental__naiveDimensions: _ }),
        (this.dimensions = new i(t, e, { autoResize: w })),
        this.updateClassName(),
        (this.targetScroll = this.animatedScroll = this.actualScroll),
        this.options.wrapper.addEventListener("scroll", this.onNativeScroll, !1),
        this.options.wrapper.addEventListener("scrollend", this.onScrollEnd, { capture: !0 }),
        this.options.anchors && this.options.wrapper === window && this.options.wrapper.addEventListener("click", this.onClick, !1),
        this.options.wrapper.addEventListener("pointerdown", this.onPointerDown, !1),
        (this.virtualScroll = new r(s, { touchMultiplier: v, wheelMultiplier: g })),
        this.virtualScroll.on("scroll", this.onVirtualScroll),
        this.options.autoToggle && this.rootElement.addEventListener("transitionend", this.onTransitionEnd, { passive: !0 }),
        this.options.autoRaf && (this.__rafID = requestAnimationFrame(this.raf));
    }
    destroy() {
      this.emitter.destroy(), this.options.wrapper.removeEventListener("scroll", this.onNativeScroll, !1), this.options.wrapper.removeEventListener("scrollend", this.onScrollEnd, { capture: !0 }), this.options.wrapper.removeEventListener("pointerdown", this.onPointerDown, !1), this.options.anchors && this.options.wrapper === window && this.options.wrapper.removeEventListener("click", this.onClick, !1), this.virtualScroll.destroy(), this.dimensions.destroy(), this.cleanUpClassName(), this.__rafID && cancelAnimationFrame(this.__rafID);
    }
    on(t, e) {
      return this.emitter.on(t, e);
    }
    off(t, e) {
      return this.emitter.off(t, e);
    }
    onScrollEnd = (t) => {
      t instanceof CustomEvent || ("smooth" !== this.isScrolling && !1 !== this.isScrolling) || t.stopPropagation();
    };
    dispatchScrollendEvent = () => {
      this.options.wrapper.dispatchEvent(new CustomEvent("scrollend", { bubbles: this.options.wrapper === window, detail: { lenisScrollEnd: !0 } }));
    };
    onTransitionEnd = (t) => {
      if (t.propertyName.includes("overflow")) {
        const t = this.isHorizontal ? "overflow-x" : "overflow-y",
          e = getComputedStyle(this.rootElement)[t];
        ["hidden", "clip"].includes(e) ? this.stop() : this.start();
      }
    };
    setScroll(t) {
      this.isHorizontal ? this.options.wrapper.scrollTo({ left: t, behavior: "instant" }) : this.options.wrapper.scrollTo({ top: t, behavior: "instant" });
    }
    onClick = (t) => {
      const e = t.composedPath().find((t) => t instanceof HTMLAnchorElement && (t.getAttribute("href")?.startsWith("#") || t.getAttribute("href")?.startsWith("/#") || t.getAttribute("href")?.startsWith("./#")));
      if (e) {
        const t = e.getAttribute("href");
        if (t) {
          const e = "object" == typeof this.options.anchors && this.options.anchors ? this.options.anchors : void 0;
          let i = `#${t.split("#")[1]}`;
          ["#", "/#", "./#", "#top", "/#top", "./#top"].includes(t) && (i = 0), this.scrollTo(i, e);
        }
      }
    };
    onPointerDown = (t) => {
      1 === t.button && this.reset();
    };
    onVirtualScroll = (t) => {
      if ("function" == typeof this.options.virtualScroll && !1 === this.options.virtualScroll(t)) return;
      const { deltaX: e, deltaY: i, event: s } = t;
      if ((this.emitter.emit("virtual-scroll", { deltaX: e, deltaY: i, event: s }), s.ctrlKey)) return;
      if (s.lenisStopPropagation) return;
      const o = s.type.includes("touch"),
        n = s.type.includes("wheel");
      this.isTouching = "touchstart" === s.type || "touchmove" === s.type;
      const r = 0 === e && 0 === i;
      if (this.options.syncTouch && o && "touchstart" === s.type && r && !this.isStopped && !this.isLocked) return void this.reset();
      const l = ("vertical" === this.options.gestureOrientation && 0 === i) || ("horizontal" === this.options.gestureOrientation && 0 === e);
      if (r || l) return;
      let h = s.composedPath();
      h = h.slice(0, h.indexOf(this.rootElement));
      const a = this.options.prevent;
      if (h.find((t) => t instanceof HTMLElement && (("function" == typeof a && a?.(t)) || t.hasAttribute?.("data-lenis-prevent") || (o && t.hasAttribute?.("data-lenis-prevent-touch")) || (n && t.hasAttribute?.("data-lenis-prevent-wheel")) || (this.options.allowNestedScroll && this.checkNestedScroll(t, { deltaX: e, deltaY: i }))))) return;
      if (this.isStopped || this.isLocked) return void s.preventDefault();
      if (!((this.options.syncTouch && o) || (this.options.smoothWheel && n))) return (this.isScrolling = "native"), this.animate.stop(), void (s.lenisStopPropagation = !0);
      let c = i;
      "both" === this.options.gestureOrientation ? (c = Math.abs(i) > Math.abs(e) ? i : e) : "horizontal" === this.options.gestureOrientation && (c = e), (!this.options.overscroll || this.options.infinite || (this.options.wrapper !== window && ((this.animatedScroll > 0 && this.animatedScroll < this.limit) || (0 === this.animatedScroll && i > 0) || (this.animatedScroll === this.limit && i < 0)))) && (s.lenisStopPropagation = !0), s.preventDefault();
      const p = o && this.options.syncTouch,
        d = o && "touchend" === s.type && Math.abs(c) > 5;
      d && (c = this.velocity * this.options.touchInertiaMultiplier), this.scrollTo(this.targetScroll + c, { programmatic: !1, ...(p ? { lerp: d ? this.options.syncTouchLerp : 1 } : { lerp: this.options.lerp, duration: this.options.duration, easing: this.options.easing }) });
    };
    resize() {
      this.dimensions.resize(), (this.animatedScroll = this.targetScroll = this.actualScroll), this.emit();
    }
    emit() {
      this.emitter.emit("scroll", this);
    }
    onNativeScroll = () => {
      if ((null !== this._resetVelocityTimeout && (clearTimeout(this._resetVelocityTimeout), (this._resetVelocityTimeout = null)), this._preventNextNativeScrollEvent)) this._preventNextNativeScrollEvent = !1;
      else if (!1 === this.isScrolling || "native" === this.isScrolling) {
        const t = this.animatedScroll;
        (this.animatedScroll = this.targetScroll = this.actualScroll),
          (this.lastVelocity = this.velocity),
          (this.velocity = this.animatedScroll - t),
          (this.direction = Math.sign(this.animatedScroll - t)),
          this.isStopped || (this.isScrolling = "native"),
          this.emit(),
          0 !== this.velocity &&
            (this._resetVelocityTimeout = setTimeout(() => {
              (this.lastVelocity = this.velocity), (this.velocity = 0), (this.isScrolling = !1), this.emit();
            }, 400));
      }
    };
    reset() {
      (this.isLocked = !1), (this.isScrolling = !1), (this.animatedScroll = this.targetScroll = this.actualScroll), (this.lastVelocity = this.velocity = 0), this.animate.stop();
    }
    start() {
      this.isStopped && (this.reset(), (this.isStopped = !1));
    }
    stop() {
      this.isStopped || (this.reset(), (this.isStopped = !0));
    }
    raf = (t) => {
      const e = t - (this.time || t);
      (this.time = t), this.animate.advance(0.001 * e), this.options.autoRaf && (this.__rafID = requestAnimationFrame(this.raf));
    };
    scrollTo(e, { offset: i = 0, immediate: s = !1, lock: o = !1, duration: n = this.options.duration, easing: r = this.options.easing, lerp: l = this.options.lerp, onStart: h, onComplete: a, force: c = !1, programmatic: p = !0, userData: d } = {}) {
      if ((!this.isStopped && !this.isLocked) || c) {
        if ("string" == typeof e && ["top", "left", "start"].includes(e)) e = 0;
        else if ("string" == typeof e && ["bottom", "right", "end"].includes(e)) e = this.limit;
        else {
          let t;
          if (("string" == typeof e ? (t = document.querySelector(e)) : e instanceof HTMLElement && e?.nodeType && (t = e), t)) {
            if (this.options.wrapper !== window) {
              const t = this.rootElement.getBoundingClientRect();
              i -= this.isHorizontal ? t.left : t.top;
            }
            const s = t.getBoundingClientRect();
            e = (this.isHorizontal ? s.left : s.top) + this.animatedScroll;
          }
        }
        if ("number" == typeof e) {
          if (((e += i), (e = Math.round(e)), this.options.infinite)) {
            if (p) {
              this.targetScroll = this.animatedScroll = this.scroll;
              const t = e - this.animatedScroll;
              t > this.limit / 2 ? (e -= this.limit) : t < -this.limit / 2 && (e += this.limit);
            }
          } else e = t(0, e, this.limit);
          if (e === this.targetScroll) return h?.(this), void a?.(this);
          if (((this.userData = d ?? {}), s))
            return (
              (this.animatedScroll = this.targetScroll = e),
              this.setScroll(this.scroll),
              this.reset(),
              this.preventNextNativeScrollEvent(),
              this.emit(),
              a?.(this),
              (this.userData = {}),
              void requestAnimationFrame(() => {
                this.dispatchScrollendEvent();
              })
            );
          p || (this.targetScroll = e),
            this.animate.fromTo(this.animatedScroll, e, {
              duration: n,
              easing: r,
              lerp: l,
              onStart: () => {
                o && (this.isLocked = !0), (this.isScrolling = "smooth"), h?.(this);
              },
              onUpdate: (t, e) => {
                (this.isScrolling = "smooth"),
                  (this.lastVelocity = this.velocity),
                  (this.velocity = t - this.animatedScroll),
                  (this.direction = Math.sign(this.velocity)),
                  (this.animatedScroll = t),
                  this.setScroll(this.scroll),
                  p && (this.targetScroll = t),
                  e || this.emit(),
                  e &&
                    (this.reset(),
                    this.emit(),
                    a?.(this),
                    (this.userData = {}),
                    requestAnimationFrame(() => {
                      this.dispatchScrollendEvent();
                    }),
                    this.preventNextNativeScrollEvent());
              },
            });
        }
      }
    }
    preventNextNativeScrollEvent() {
      (this._preventNextNativeScrollEvent = !0),
        requestAnimationFrame(() => {
          this._preventNextNativeScrollEvent = !1;
        });
    }
    checkNestedScroll(t, { deltaX: e, deltaY: i }) {
      const s = Date.now(),
        o = (t._lenis ??= {});
      let n, r, l, h, a, c, p, d;
      const u = this.options.gestureOrientation;
      if (s - (o.time ?? 0) > 2e3) {
        o.time = Date.now();
        const e = window.getComputedStyle(t);
        o.computedStyle = e;
        const i = e.overflowX,
          s = e.overflowY;
        if (((n = ["auto", "overlay", "scroll"].includes(i)), (r = ["auto", "overlay", "scroll"].includes(s)), (o.hasOverflowX = n), (o.hasOverflowY = r), !n && !r)) return !1;
        if ("vertical" === u && !r) return !1;
        if ("horizontal" === u && !n) return !1;
        (a = t.scrollWidth), (c = t.scrollHeight), (p = t.clientWidth), (d = t.clientHeight), (l = a > p), (h = c > d), (o.isScrollableX = l), (o.isScrollableY = h), (o.scrollWidth = a), (o.scrollHeight = c), (o.clientWidth = p), (o.clientHeight = d);
      } else (l = o.isScrollableX), (h = o.isScrollableY), (n = o.hasOverflowX), (r = o.hasOverflowY), (a = o.scrollWidth), (c = o.scrollHeight), (p = o.clientWidth), (d = o.clientHeight);
      if ((!n && !r) || (!l && !h)) return !1;
      if (!("vertical" !== u || (r && h))) return !1;
      if (!("horizontal" !== u || (n && l))) return !1;
      let m, v, g, w, S, f;
      if ("horizontal" === u) m = "x";
      else if ("vertical" === u) m = "y";
      else {
        0 !== e && n && l && (m = "x"), 0 !== i && r && h && (m = "y");
      }
      if (!m) return !1;
      if ("x" === m) (v = t.scrollLeft), (g = a - p), (w = e), (S = n), (f = l);
      else {
        if ("y" !== m) return !1;
        (v = t.scrollTop), (g = c - d), (w = i), (S = r), (f = h);
      }
      return (w > 0 ? v < g : v > 0) && S && f;
    }
    get rootElement() {
      return this.options.wrapper === window ? document.documentElement : this.options.wrapper;
    }
    get limit() {
      return this.options.__experimental__naiveDimensions ? (this.isHorizontal ? this.rootElement.scrollWidth - this.rootElement.clientWidth : this.rootElement.scrollHeight - this.rootElement.clientHeight) : this.dimensions.limit[this.isHorizontal ? "x" : "y"];
    }
    get isHorizontal() {
      return "horizontal" === this.options.orientation;
    }
    get actualScroll() {
      const t = this.options.wrapper;
      return this.isHorizontal ? t.scrollX ?? t.scrollLeft : t.scrollY ?? t.scrollTop;
    }
    get scroll() {
      return this.options.infinite ? ((t = this.animatedScroll), (e = this.limit), ((t % e) + e) % e) : this.animatedScroll;
      var t, e;
    }
    get progress() {
      return 0 === this.limit ? 1 : this.scroll / this.limit;
    }
    get isScrolling() {
      return this._isScrolling;
    }
    set isScrolling(t) {
      this._isScrolling !== t && ((this._isScrolling = t), this.updateClassName());
    }
    get isStopped() {
      return this._isStopped;
    }
    set isStopped(t) {
      this._isStopped !== t && ((this._isStopped = t), this.updateClassName());
    }
    get isLocked() {
      return this._isLocked;
    }
    set isLocked(t) {
      this._isLocked !== t && ((this._isLocked = t), this.updateClassName());
    }
    get isSmooth() {
      return "smooth" === this.isScrolling;
    }
    get className() {
      let t = "lenis";
      return this.options.autoToggle && (t += " lenis-autoToggle"), this.isStopped && (t += " lenis-stopped"), this.isLocked && (t += " lenis-locked"), this.isScrolling && (t += " lenis-scrolling"), "smooth" === this.isScrolling && (t += " lenis-smooth"), t;
    }
    updateClassName() {
      this.cleanUpClassName(), (this.rootElement.className = `${this.rootElement.className} ${this.className}`.trim());
    }
    cleanUpClassName() {
      this.rootElement.className = this.rootElement.className.replace(/lenis(-\w+)?/g, "").trim();
    }
  };
(globalThis.Lenis = Lenis), (globalThis.Lenis.prototype = Lenis.prototype); //# sourceMappingURL=lenis.min.js.map

/*!
  * PhotoSwipe Lightbox 5.3.4 - https://photoswipe.com
  * (c) 2022 Dmytro Semenov
  */
!function(t,i){"object"==typeof exports&&"undefined"!=typeof module?module.exports=i():"function"==typeof define&&define.amd?define(i):(t="undefined"!=typeof globalThis?globalThis:t||self).PhotoSwipeLightbox=i()}(this,(function(){"use strict";function t(t,i,s){const h=document.createElement(i||"div");return t&&(h.className=t),s&&s.appendChild(h),h}function i(t,i,s){t.style.width="number"==typeof i?i+"px":i,t.style.height="number"==typeof s?s+"px":s}const s="idle",h="loading",e="loaded",n="error";function o(t,i,s=document){let h=[];if(t instanceof Element)h=[t];else if(t instanceof NodeList||Array.isArray(t))h=Array.from(t);else{const e="string"==typeof t?t:i;e&&(h=Array.from(s.querySelectorAll(e)))}return h}function r(){return!(!navigator.vendor||!navigator.vendor.match(/apple/i))}class a{constructor(t,i){this.type=t,i&&Object.assign(this,i)}preventDefault(){this.defaultPrevented=!0}}class c{constructor(i,s){this.element=t("pswp__img pswp__img--placeholder",i?"img":"",s),i&&(this.element.decoding="async",this.element.alt="",this.element.src=i,this.element.setAttribute("role","presentation")),this.element.setAttribute("aria-hidden","true")}setDisplayedSize(t,s){this.element&&("IMG"===this.element.tagName?(i(this.element,250,"auto"),this.element.style.transformOrigin="0 0",this.element.style.transform=function(t,i,s){let h="translate3d("+t+"px,"+(i||0)+"px,0)";return void 0!==s&&(h+=" scale3d("+s+","+s+",1)"),h}(0,0,t/250)):i(this.element,t,s))}destroy(){this.element.parentNode&&this.element.remove(),this.element=null}}class l{constructor(t,i,h){this.instance=i,this.data=t,this.index=h,this.element=void 0,this.displayedImageWidth=0,this.displayedImageHeight=0,this.width=Number(this.data.w)||Number(this.data.width)||0,this.height=Number(this.data.h)||Number(this.data.height)||0,this.isAttached=!1,this.hasSlide=!1,this.state=s,this.data.type?this.type=this.data.type:this.data.src?this.type="image":this.type="html",this.instance.dispatch("contentInit",{content:this})}removePlaceholder(){this.placeholder&&!this.keepPlaceholder()&&setTimeout((()=>{this.placeholder&&(this.placeholder.destroy(),this.placeholder=null)}),1e3)}load(i,s){if(this.slide&&this.usePlaceholder())if(this.placeholder){const t=this.placeholder.element;t&&!t.parentElement&&this.slide.container.prepend(t)}else{const t=this.instance.applyFilters("placeholderSrc",!(!this.data.msrc||!this.slide.isFirstSlide)&&this.data.msrc,this);this.placeholder=new c(t,this.slide.container)}this.element&&!s||this.instance.dispatch("contentLoad",{content:this,isLazy:i}).defaultPrevented||(this.isImageContent()?(this.element=t("pswp__img","img"),this.displayedImageWidth&&this.loadImage(i)):(this.element=t("pswp__content"),this.element.innerHTML=this.data.html||""),s&&this.slide&&this.slide.updateContentSize(!0))}loadImage(t){const i=this.element;this.instance.dispatch("contentLoadImage",{content:this,isLazy:t}).defaultPrevented||(this.updateSrcsetSizes(),this.data.srcset&&(i.srcset=this.data.srcset),i.src=this.data.src,i.alt=this.data.alt||"",this.state=h,i.complete?this.onLoaded():(i.onload=()=>{this.onLoaded()},i.onerror=()=>{this.onError()}))}setSlide(t){this.slide=t,this.hasSlide=!0,this.instance=t.pswp}onLoaded(){this.state=e,this.slide&&(this.instance.dispatch("loadComplete",{slide:this.slide,content:this}),this.slide.isActive&&this.slide.heavyAppended&&!this.element.parentNode&&(this.append(),this.slide.updateContentSize(!0)),this.state!==e&&this.state!==n||this.removePlaceholder())}onError(){this.state=n,this.slide&&(this.displayError(),this.instance.dispatch("loadComplete",{slide:this.slide,isError:!0,content:this}),this.instance.dispatch("loadError",{slide:this.slide,content:this}))}isLoading(){return this.instance.applyFilters("isContentLoading",this.state===h,this)}isError(){return this.state===n}isImageContent(){return"image"===this.type}setDisplayedSize(t,s){if(this.element&&(this.placeholder&&this.placeholder.setDisplayedSize(t,s),!this.instance.dispatch("contentResize",{content:this,width:t,height:s}).defaultPrevented&&(i(this.element,t,s),this.isImageContent()&&!this.isError()))){const i=!this.displayedImageWidth&&t;this.displayedImageWidth=t,this.displayedImageHeight=s,i?this.loadImage(!1):this.updateSrcsetSizes(),this.slide&&this.instance.dispatch("imageSizeChange",{slide:this.slide,width:t,height:s,content:this})}}isZoomable(){return this.instance.applyFilters("isContentZoomable",this.isImageContent()&&this.state!==n,this)}updateSrcsetSizes(){if(this.data.srcset){const t=this.element,i=this.instance.applyFilters("srcsetSizesWidth",this.displayedImageWidth,this);(!t.dataset.largestUsedSize||i>parseInt(t.dataset.largestUsedSize,10))&&(t.sizes=i+"px",t.dataset.largestUsedSize=String(i))}}usePlaceholder(){return this.instance.applyFilters("useContentPlaceholder",this.isImageContent(),this)}lazyLoad(){this.instance.dispatch("contentLazyLoad",{content:this}).defaultPrevented||this.load(!0)}keepPlaceholder(){return this.instance.applyFilters("isKeepingPlaceholder",this.isLoading(),this)}destroy(){this.hasSlide=!1,this.slide=null,this.instance.dispatch("contentDestroy",{content:this}).defaultPrevented||(this.remove(),this.placeholder&&(this.placeholder.destroy(),this.placeholder=null),this.isImageContent()&&this.element&&(this.element.onload=null,this.element.onerror=null,this.element=null))}displayError(){if(this.slide){let i=t("pswp__error-msg");i.innerText=this.instance.options.errorMsg,i=this.instance.applyFilters("contentErrorElement",i,this),this.element=t("pswp__content pswp__error-msg-container"),this.element.appendChild(i),this.slide.container.innerText="",this.slide.container.appendChild(this.element),this.slide.updateContentSize(!0),this.removePlaceholder()}}append(){if(this.isAttached)return;if(this.isAttached=!0,this.state===n)return void this.displayError();if(this.instance.dispatch("contentAppend",{content:this}).defaultPrevented)return;const t="decode"in this.element;this.isImageContent()?t&&this.slide&&(!this.slide.isActive||r())?(this.isDecoding=!0,this.element.decode().catch((()=>{})).finally((()=>{this.isDecoding=!1,this.appendImage()}))):this.appendImage():this.element&&!this.element.parentNode&&this.slide.container.appendChild(this.element)}activate(){this.instance.dispatch("contentActivate",{content:this}).defaultPrevented||this.slide&&(this.isImageContent()&&this.isDecoding&&!r()?this.appendImage():this.isError()&&this.load(!1,!0),this.slide.holderElement&&this.slide.holderElement.setAttribute("aria-hidden","false"))}deactivate(){this.instance.dispatch("contentDeactivate",{content:this}),this.slide&&this.slide.holderElement&&this.slide.holderElement.setAttribute("aria-hidden","true")}remove(){this.isAttached=!1,this.instance.dispatch("contentRemove",{content:this}).defaultPrevented||(this.element&&this.element.parentNode&&this.element.remove(),this.placeholder&&this.placeholder.element&&this.placeholder.element.remove())}appendImage(){this.isAttached&&(this.instance.dispatch("contentAppendImage",{content:this}).defaultPrevented||(this.slide&&this.element&&!this.element.parentNode&&this.slide.container.appendChild(this.element),this.state!==e&&this.state!==n||this.removePlaceholder()))}}function d(t,i,s,h,e){let n;if(i.paddingFn)n=i.paddingFn(s,h,e)[t];else if(i.padding)n=i.padding[t];else{const s="padding"+t[0].toUpperCase()+t.slice(1);i[s]&&(n=i[s])}return n||0}class u{constructor(t,i,s,h){this.pswp=h,this.options=t,this.itemData=i,this.index=s}update(t,i,s){this.elementSize={x:t,y:i},this.panAreaSize=s;const h=this.panAreaSize.x/this.elementSize.x,e=this.panAreaSize.y/this.elementSize.y;this.fit=Math.min(1,h<e?h:e),this.fill=Math.min(1,h>e?h:e),this.vFill=Math.min(1,e),this.initial=this.t(),this.secondary=this.i(),this.max=Math.max(this.initial,this.secondary,this.o()),this.min=Math.min(this.fit,this.initial,this.secondary),this.pswp&&this.pswp.dispatch("zoomLevelsUpdate",{zoomLevels:this,slideData:this.itemData})}l(t){const i=t+"ZoomLevel",s=this.options[i];if(s)return"function"==typeof s?s(this):"fill"===s?this.fill:"fit"===s?this.fit:Number(s)}i(){let t=this.l("secondary");return t||(t=Math.min(1,3*this.fit),t*this.elementSize.x>4e3&&(t=4e3/this.elementSize.x),t)}t(){return this.l("initial")||this.fit}o(){const t=this.l("max");return t||Math.max(1,4*this.fit)}}function p(t,i,s){const h=i.createContentFromData(t,s);if(!h||!h.lazyLoad)return;const{options:e}=i,n=i.viewportSize||function(t,i){if(t.getViewportSizeFn){const s=t.getViewportSizeFn(t,i);if(s)return s}return{x:document.documentElement.clientWidth,y:window.innerHeight}}(e,i),o=function(t,i,s,h){return{x:i.x-d("left",t,i,s,h)-d("right",t,i,s,h),y:i.y-d("top",t,i,s,h)-d("bottom",t,i,s,h)}}(e,n,t,s),r=new u(e,t,-1);return r.update(h.width,h.height,o),h.lazyLoad(),h.setDisplayedSize(Math.ceil(h.width*r.initial),Math.ceil(h.height*r.initial)),h}return class extends class extends class{constructor(){this.u={},this.p={},this.pswp=void 0,this.options=void 0}addFilter(t,i,s=100){this.p[t]||(this.p[t]=[]),this.p[t].push({fn:i,priority:s}),this.p[t].sort(((t,i)=>t.priority-i.priority)),this.pswp&&this.pswp.addFilter(t,i,s)}removeFilter(t,i){this.p[t]&&(this.p[t]=this.p[t].filter((t=>t.fn!==i))),this.pswp&&this.pswp.removeFilter(t,i)}applyFilters(t,...i){return this.p[t]&&this.p[t].forEach((t=>{i[0]=t.fn.apply(this,i)})),i[0]}on(t,i){this.u[t]||(this.u[t]=[]),this.u[t].push(i),this.pswp&&this.pswp.on(t,i)}off(t,i){this.u[t]&&(this.u[t]=this.u[t].filter((t=>i!==t))),this.pswp&&this.pswp.off(t,i)}dispatch(t,i){if(this.pswp)return this.pswp.dispatch(t,i);const s=new a(t,i);return this.u?(this.u[t]&&this.u[t].forEach((t=>{t.call(this,s)})),s):s}}{getNumItems(){let t;const{dataSource:i}=this.options;i?"length"in i?t=i.length:"gallery"in i&&(i.items||(i.items=this.m(i.gallery)),i.items&&(t=i.items.length)):t=0;const s=this.dispatch("numItems",{dataSource:i,numItems:t});return this.applyFilters("numItems",s.numItems,i)}createContentFromData(t,i){return new l(t,this,i)}getItemData(t){const{dataSource:i}=this.options;let s;Array.isArray(i)?s=i[t]:i&&i.gallery&&(i.items||(i.items=this.m(i.gallery)),s=i.items[t]);let h=s;h instanceof Element&&(h=this.g(h));const e=this.dispatch("itemData",{itemData:h||{},index:t});return this.applyFilters("itemData",e.itemData,t)}m(t){return this.options.children||this.options.childSelector?o(this.options.children,this.options.childSelector,t)||[]:[t]}g(t){const i={element:t},s="A"===t.tagName?t:t.querySelector("a");if(s){i.src=s.dataset.pswpSrc||s.href,s.dataset.pswpSrcset&&(i.srcset=s.dataset.pswpSrcset),i.width=parseInt(s.dataset.pswpWidth,10),i.height=parseInt(s.dataset.pswpHeight,10),i.w=i.width,i.h=i.height,s.dataset.pswpType&&(i.type=s.dataset.pswpType);const h=t.querySelector("img");h&&(i.msrc=h.currentSrc||h.src,i.alt=h.getAttribute("alt")),(s.dataset.pswpCropped||s.dataset.cropped)&&(i.thumbCropped=!0)}return this.applyFilters("domItemData",i,t,s)}lazyLoadData(t,i){return p(t,this,i)}}{constructor(t){super(),this.options=t||{},this.v=0}init(){this.onThumbnailsClick=this.onThumbnailsClick.bind(this),o(this.options.gallery,this.options.gallerySelector).forEach((t=>{t.addEventListener("click",this.onThumbnailsClick,!1)}))}onThumbnailsClick(t){if(function(t){if(2===t.which||t.ctrlKey||t.metaKey||t.altKey||t.shiftKey)return!0}(t)||window.pswp||!1===window.navigator.onLine)return;let i={x:t.clientX,y:t.clientY};i.x||i.y||(i=null);let s=this.getClickedIndex(t);s=this.applyFilters("clickedIndex",s,t,this);const h={gallery:t.currentTarget};s>=0&&(t.preventDefault(),this.loadAndOpen(s,h,i))}getClickedIndex(t){if(this.options.getClickedIndexFn)return this.options.getClickedIndexFn.call(this,t);const i=t.target,s=o(this.options.children,this.options.childSelector,t.currentTarget).findIndex((t=>t===i||t.contains(i)));return-1!==s?s:this.options.children||this.options.childSelector?-1:0}loadAndOpen(t,i,s){return!window.pswp&&(this.options.index=t,this.options.initialPointerPos=s,this.shouldOpen=!0,this.preload(t,i),!0)}preload(t,i){const{options:s}=this;i&&(s.dataSource=i);const h=[],e=typeof s.pswpModule;if("function"==typeof(n=s.pswpModule)&&n.prototype&&n.prototype.goTo)h.push(Promise.resolve(s.pswpModule));else{if("string"===e)throw new Error("pswpModule as string is no longer supported");if("function"!==e)throw new Error("pswpModule is not valid");h.push(s.pswpModule())}var n;"function"==typeof s.openPromise&&h.push(s.openPromise()),!1!==s.preloadFirstSlide&&t>=0&&(this._=function(t,i){const s=i.getItemData(t);if(!i.dispatch("lazyLoadSlide",{index:t,itemData:s}).defaultPrevented)return p(s,i,t)}(t,this));const o=++this.v;Promise.all(h).then((t=>{if(this.shouldOpen){const i=t[0];this.I(i,o)}}))}I(t,i){if(i!==this.v&&this.shouldOpen)return;if(this.shouldOpen=!1,window.pswp)return;const s="object"==typeof t?new t.default(this.options):new t(this.options);this.pswp=s,window.pswp=s,Object.keys(this.u).forEach((t=>{this.u[t].forEach((i=>{s.on(t,i)}))})),Object.keys(this.p).forEach((t=>{this.p[t].forEach((i=>{s.addFilter(t,i.fn,i.priority)}))})),this._&&(s.contentLoader.addToCache(this._),this._=null),s.on("destroy",(()=>{this.pswp=null,window.pswp=null})),s.init()}destroy(){this.pswp&&this.pswp.destroy(),this.shouldOpen=!1,this.u=null,o(this.options.gallery,this.options.gallerySelector).forEach((t=>{t.removeEventListener("click",this.onThumbnailsClick,!1)}))}}}));

/*!
  * PhotoSwipe 5.3.4 - https://photoswipe.com
  * (c) 2022 Dmytro Semenov
  */
!function(t,i){"object"==typeof exports&&"undefined"!=typeof module?module.exports=i():"function"==typeof define&&define.amd?define(i):(t="undefined"!=typeof globalThis?globalThis:t||self).PhotoSwipe=i()}(this,(function(){"use strict";function t(t,i,s){const h=document.createElement(i||"div");return t&&(h.className=t),s&&s.appendChild(h),h}function i(t,i){return t.x=i.x,t.y=i.y,void 0!==i.id&&(t.id=i.id),t}function s(t){t.x=Math.round(t.x),t.y=Math.round(t.y)}function h(t,i){const s=Math.abs(t.x-i.x),h=Math.abs(t.y-i.y);return Math.sqrt(s*s+h*h)}function e(t,i){return t.x===i.x&&t.y===i.y}function n(t,i,s){return Math.min(Math.max(t,i),s)}function o(t,i,s){let h="translate3d("+t+"px,"+(i||0)+"px,0)";return void 0!==s&&(h+=" scale3d("+s+","+s+",1)"),h}function r(t,i,s,h){t.style.transform=o(i,s,h)}function a(t,i,s,h){t.style.transition=i?i+" "+s+"ms "+(h||"cubic-bezier(.4,0,.22,1)"):"none"}function c(t,i,s){t.style.width="number"==typeof i?i+"px":i,t.style.height="number"==typeof s?s+"px":s}const l="idle",p="loading",u="loaded",d="error";function m(){return!(!navigator.vendor||!navigator.vendor.match(/apple/i))}let f=!1;try{window.addEventListener("test",null,Object.defineProperty({},"passive",{get:()=>{f=!0}}))}catch(t){}class w{constructor(){this.t=[]}add(t,i,s,h){this.i(t,i,s,h)}remove(t,i,s,h){this.i(t,i,s,h,!0)}removeAll(){this.t.forEach((t=>{this.i(t.target,t.type,t.listener,t.passive,!0,!0)})),this.t=[]}i(t,i,s,h,e,n){if(!t)return;const o=e?"removeEventListener":"addEventListener";i.split(" ").forEach((i=>{if(i){n||(e?this.t=this.t.filter((h=>h.type!==i||h.listener!==s||h.target!==t)):this.t.push({target:t,type:i,listener:s,passive:h}));const r=!!f&&{passive:h||!1};t[o](i,s,r)}}))}}function g(t,i){if(t.getViewportSizeFn){const s=t.getViewportSizeFn(t,i);if(s)return s}return{x:document.documentElement.clientWidth,y:window.innerHeight}}function _(t,i,s,h,e){let n;if(i.paddingFn)n=i.paddingFn(s,h,e)[t];else if(i.padding)n=i.padding[t];else{const s="padding"+t[0].toUpperCase()+t.slice(1);i[s]&&(n=i[s])}return n||0}function v(t,i,s,h){return{x:i.x-_("left",t,i,s,h)-_("right",t,i,s,h),y:i.y-_("top",t,i,s,h)-_("bottom",t,i,s,h)}}class y{constructor(t){this.slide=t,this.currZoomLevel=1,this.center={},this.max={},this.min={},this.reset()}update(t){this.currZoomLevel=t,this.slide.width?(this.o("x"),this.o("y"),this.slide.pswp.dispatch("calcBounds",{slide:this.slide})):this.reset()}o(t){const{pswp:i}=this.slide,s=this.slide["x"===t?"width":"height"]*this.currZoomLevel,h=_("x"===t?"left":"top",i.options,i.viewportSize,this.slide.data,this.slide.index),e=this.slide.panAreaSize[t];this.center[t]=Math.round((e-s)/2)+h,this.max[t]=s>e?Math.round(e-s)+h:this.center[t],this.min[t]=s>e?h:this.center[t]}reset(){this.center.x=0,this.center.y=0,this.max.x=0,this.max.y=0,this.min.x=0,this.min.y=0}correctPan(t,i){return n(i,this.max[t],this.min[t])}}class b{constructor(t,i,s,h){this.pswp=h,this.options=t,this.itemData=i,this.index=s}update(t,i,s){this.elementSize={x:t,y:i},this.panAreaSize=s;const h=this.panAreaSize.x/this.elementSize.x,e=this.panAreaSize.y/this.elementSize.y;this.fit=Math.min(1,h<e?h:e),this.fill=Math.min(1,h>e?h:e),this.vFill=Math.min(1,e),this.initial=this.l(),this.secondary=this.p(),this.max=Math.max(this.initial,this.secondary,this.u()),this.min=Math.min(this.fit,this.initial,this.secondary),this.pswp&&this.pswp.dispatch("zoomLevelsUpdate",{zoomLevels:this,slideData:this.itemData})}m(t){const i=t+"ZoomLevel",s=this.options[i];if(s)return"function"==typeof s?s(this):"fill"===s?this.fill:"fit"===s?this.fit:Number(s)}p(){let t=this.m("secondary");return t||(t=Math.min(1,3*this.fit),t*this.elementSize.x>4e3&&(t=4e3/this.elementSize.x),t)}l(){return this.m("initial")||this.fit}u(){const t=this.m("max");return t||Math.max(1,4*this.fit)}}class S{constructor(i,s,h){this.data=i,this.index=s,this.pswp=h,this.isActive=s===h.currIndex,this.currentResolution=0,this.panAreaSize={},this.isFirstSlide=this.isActive&&!h.opener.isOpen,this.zoomLevels=new b(h.options,i,s,h),this.pswp.dispatch("gettingData",{slide:this,data:this.data,index:s}),this.pan={x:0,y:0},this.content=this.pswp.contentLoader.getContentBySlide(this),this.container=t("pswp__zoom-wrap"),this.currZoomLevel=1,this.width=this.content.width,this.height=this.content.height,this.bounds=new y(this),this.prevDisplayedWidth=-1,this.prevDisplayedHeight=-1,this.pswp.dispatch("slideInit",{slide:this})}setIsActive(t){t&&!this.isActive?this.activate():!t&&this.isActive&&this.deactivate()}append(t){this.holderElement=t,this.container.style.transformOrigin="0 0",this.data&&(this.calculateSize(),this.load(),this.updateContentSize(),this.appendHeavy(),this.holderElement.appendChild(this.container),this.zoomAndPanToInitial(),this.pswp.dispatch("firstZoomPan",{slide:this}),this.applyCurrentZoomPan(),this.pswp.dispatch("afterSetContent",{slide:this}),this.isActive&&this.activate())}load(){this.content.load(),this.pswp.dispatch("slideLoad",{slide:this})}appendHeavy(){const{pswp:t}=this;!this.heavyAppended&&t.opener.isOpen&&!t.mainScroll.isShifted()&&(this.isActive,1)&&(this.pswp.dispatch("appendHeavy",{slide:this}).defaultPrevented||(this.heavyAppended=!0,this.content.append(),this.pswp.dispatch("appendHeavyContent",{slide:this})))}activate(){this.isActive=!0,this.appendHeavy(),this.content.activate(),this.pswp.dispatch("slideActivate",{slide:this})}deactivate(){this.isActive=!1,this.content.deactivate(),this.currZoomLevel!==this.zoomLevels.initial&&this.calculateSize(),this.currentResolution=0,this.zoomAndPanToInitial(),this.applyCurrentZoomPan(),this.updateContentSize(),this.pswp.dispatch("slideDeactivate",{slide:this})}destroy(){this.content.hasSlide=!1,this.content.remove(),this.container.remove(),this.pswp.dispatch("slideDestroy",{slide:this})}resize(){this.currZoomLevel!==this.zoomLevels.initial&&this.isActive?(this.calculateSize(),this.bounds.update(this.currZoomLevel),this.panTo(this.pan.x,this.pan.y)):(this.calculateSize(),this.currentResolution=0,this.zoomAndPanToInitial(),this.applyCurrentZoomPan(),this.updateContentSize())}updateContentSize(t){const i=this.currentResolution||this.zoomLevels.initial;if(!i)return;const s=Math.round(this.width*i)||this.pswp.viewportSize.x,h=Math.round(this.height*i)||this.pswp.viewportSize.y;(this.sizeChanged(s,h)||t)&&this.content.setDisplayedSize(s,h)}sizeChanged(t,i){return(t!==this.prevDisplayedWidth||i!==this.prevDisplayedHeight)&&(this.prevDisplayedWidth=t,this.prevDisplayedHeight=i,!0)}getPlaceholderElement(){if(this.content.placeholder)return this.content.placeholder.element}zoomTo(t,i,h,e){const{pswp:o}=this;if(!this.isZoomable()||o.mainScroll.isShifted())return;o.dispatch("beforeZoomTo",{destZoomLevel:t,centerPoint:i,transitionDuration:h}),o.animations.stopAllPan();const r=this.currZoomLevel;e||(t=n(t,this.zoomLevels.min,this.zoomLevels.max)),this.setZoomLevel(t),this.pan.x=this.calculateZoomToPanOffset("x",i,r),this.pan.y=this.calculateZoomToPanOffset("y",i,r),s(this.pan);const a=()=>{this.g(t),this.applyCurrentZoomPan()};h?o.animations.startTransition({isPan:!0,name:"zoomTo",target:this.container,transform:this.getCurrentTransform(),onComplete:a,duration:h,easing:o.options.easing}):a()}toggleZoom(t){this.zoomTo(this.currZoomLevel===this.zoomLevels.initial?this.zoomLevels.secondary:this.zoomLevels.initial,t,this.pswp.options.zoomAnimationDuration)}setZoomLevel(t){this.currZoomLevel=t,this.bounds.update(this.currZoomLevel)}calculateZoomToPanOffset(t,i,s){if(0===this.bounds.max[t]-this.bounds.min[t])return this.bounds.center[t];i||(i=this.pswp.getViewportCenterPoint());const h=this.currZoomLevel/s;return this.bounds.correctPan(t,(this.pan[t]-i[t])*h+i[t])}panTo(t,i){this.pan.x=this.bounds.correctPan("x",t),this.pan.y=this.bounds.correctPan("y",i),this.applyCurrentZoomPan()}isPannable(){return this.width&&this.currZoomLevel>this.zoomLevels.fit}isZoomable(){return this.width&&this.content.isZoomable()}applyCurrentZoomPan(){this._(this.pan.x,this.pan.y,this.currZoomLevel),this===this.pswp.currSlide&&this.pswp.dispatch("zoomPanUpdate",{slide:this})}zoomAndPanToInitial(){this.currZoomLevel=this.zoomLevels.initial,this.bounds.update(this.currZoomLevel),i(this.pan,this.bounds.center),this.pswp.dispatch("initialZoomPan",{slide:this})}_(t,i,s){s/=this.currentResolution||this.zoomLevels.initial,r(this.container,t,i,s)}calculateSize(){const{pswp:t}=this;i(this.panAreaSize,v(t.options,t.viewportSize,this.data,this.index)),this.zoomLevels.update(this.width,this.height,this.panAreaSize),t.dispatch("calcSlideSize",{slide:this})}getCurrentTransform(){const t=this.currZoomLevel/(this.currentResolution||this.zoomLevels.initial);return o(this.pan.x,this.pan.y,t)}g(t){t!==this.currentResolution&&(this.currentResolution=t,this.updateContentSize(),this.pswp.dispatch("resolutionChanged"))}}class x{constructor(t){this.gestures=t,this.pswp=t.pswp,this.startPan={}}start(){i(this.startPan,this.pswp.currSlide.pan),this.pswp.animations.stopAll()}change(){const{p1:t,prevP1:i,dragAxis:h,pswp:e}=this.gestures,{currSlide:n}=e;if("y"===h&&e.options.closeOnVerticalDrag&&n.currZoomLevel<=n.zoomLevels.fit&&!this.gestures.isMultitouch){const s=n.pan.y+(t.y-i.y);if(!e.dispatch("verticalDrag",{panY:s}).defaultPrevented){this.v("y",s,.6);const t=1-Math.abs(this.S(n.pan.y));e.applyBgOpacity(t),n.applyCurrentZoomPan()}}else{this.M("x")||(this.M("y"),s(n.pan),n.applyCurrentZoomPan())}}end(){const{pswp:t,velocity:i}=this.gestures,{mainScroll:s}=t;let h=0;if(t.animations.stopAll(),s.isShifted()){const e=(s.x-s.getCurrSlideX())/t.viewportSize.x;i.x<-.5&&e<0||i.x<.1&&e<-.5?(h=1,i.x=Math.min(i.x,0)):(i.x>.5&&e>0||i.x>-.1&&e>.5)&&(h=-1,i.x=Math.max(i.x,0)),s.moveIndexBy(h,!0,i.x)}t.currSlide.currZoomLevel>t.currSlide.zoomLevels.max||this.gestures.isMultitouch?this.gestures.zoomLevels.correctZoomPan(!0):(this.P("x"),this.P("y"))}P(t){const{pswp:i}=this,{currSlide:s}=i,{velocity:h}=this.gestures,{pan:e,bounds:o}=s,r=e[t],a=i.bgOpacity<1&&"y"===t,c=r+function(t,i){return t*i/(1-i)}(h[t],.995);if(a){const t=this.S(r),s=this.S(c);if(t<0&&s<-.4||t>0&&s>.4)return void i.close()}const l=o.correctPan(t,c);if(r===l)return;const p=l===c?1:.82,u=i.bgOpacity,d=l-r;i.animations.startSpring({name:"panGesture"+t,isPan:!0,start:r,end:l,velocity:h[t],dampingRatio:p,onUpdate:h=>{if(a&&i.bgOpacity<1){const t=1-(l-h)/d;i.applyBgOpacity(n(u+(1-u)*t,0,1))}e[t]=Math.floor(h),s.applyCurrentZoomPan()}})}M(t){const{p1:i,pswp:s,dragAxis:h,prevP1:e,isMultitouch:n}=this.gestures,{currSlide:o,mainScroll:r}=s,a=i[t]-e[t],c=r.x+a;if(!a)return;if("x"===t&&!o.isPannable()&&!n)return r.moveTo(c,!0),!0;const{bounds:l}=o,p=o.pan[t]+a;if(s.options.allowPanToNext&&"x"===h&&"x"===t&&!n){const i=r.getCurrSlideX(),s=r.x-i,h=a>0,e=!h;if(p>l.min[t]&&h){if(l.min[t]<=this.startPan[t])return r.moveTo(c,!0),!0;this.v(t,p)}else if(p<l.max[t]&&e){if(this.startPan[t]<=l.max[t])return r.moveTo(c,!0),!0;this.v(t,p)}else if(0!==s){if(s>0)return r.moveTo(Math.max(c,i),!0),!0;if(s<0)return r.moveTo(Math.min(c,i),!0),!0}else this.v(t,p)}else"y"===t&&(r.isShifted()||l.min.y===l.max.y)||this.v(t,p)}S(t){return(t-this.pswp.currSlide.bounds.center.y)/(this.pswp.viewportSize.y/3)}v(t,i,s){const{pan:h,bounds:e}=this.pswp.currSlide;if(e.correctPan(t,i)!==i||s){const e=Math.round(i-h[t]);h[t]+=e*(s||.35)}else h[t]=i}}function M(t,i,s){return t.x=(i.x+s.x)/2,t.y=(i.y+s.y)/2,t}class z{constructor(t){this.gestures=t,this.pswp=this.gestures.pswp,this.C={},this.T={},this.D={}}start(){this.I=this.pswp.currSlide.currZoomLevel,i(this.C,this.pswp.currSlide.pan),this.pswp.animations.stopAllPan(),this.A=!1}change(){const{p1:t,startP1:i,p2:s,startP2:e,pswp:n}=this.gestures,{currSlide:o}=n,r=o.zoomLevels.min,a=o.zoomLevels.max;if(!o.isZoomable()||n.mainScroll.isShifted())return;M(this.T,i,e),M(this.D,t,s);let c=1/h(i,e)*h(t,s)*this.I;if(c>o.zoomLevels.initial+o.zoomLevels.initial/15&&(this.A=!0),c<r)if(n.options.pinchToClose&&!this.A&&this.I<=o.zoomLevels.initial){const t=1-(r-c)/(r/1.2);n.dispatch("pinchClose",{bgOpacity:t}).defaultPrevented||n.applyBgOpacity(t)}else c=r-.15*(r-c);else c>a&&(c=a+.05*(c-a));o.pan.x=this.L("x",c),o.pan.y=this.L("y",c),o.setZoomLevel(c),o.applyCurrentZoomPan()}end(){const{pswp:t}=this,{currSlide:i}=t;i.currZoomLevel<i.zoomLevels.initial&&!this.A&&t.options.pinchToClose?t.close():this.correctZoomPan()}L(t,i){const s=i/this.I;return this.D[t]-(this.T[t]-this.C[t])*s}correctZoomPan(t){const{pswp:s}=this,{currSlide:h}=s;if(!h.isZoomable())return;void 0===this.D.x&&(t=!0);const o=h.currZoomLevel;let r,a=!0;o<h.zoomLevels.initial?r=h.zoomLevels.initial:o>h.zoomLevels.max?r=h.zoomLevels.max:(a=!1,r=o);const c=s.bgOpacity,l=s.bgOpacity<1,p=i({},h.pan);let u=i({},p);t&&(this.D.x=0,this.D.y=0,this.T.x=0,this.T.y=0,this.I=o,i(this.C,p)),a&&(u={x:this.L("x",r),y:this.L("y",r)}),h.setZoomLevel(r),u={x:h.bounds.correctPan("x",u.x),y:h.bounds.correctPan("y",u.y)},h.setZoomLevel(o);let d=!0;if(e(u,p)&&(d=!1),!d&&!a&&!l)return h.g(r),void h.applyCurrentZoomPan();s.animations.stopAllPan(),s.animations.startSpring({isPan:!0,start:0,end:1e3,velocity:0,dampingRatio:1,naturalFrequency:40,onUpdate:t=>{if(t/=1e3,d||a){if(d&&(h.pan.x=p.x+(u.x-p.x)*t,h.pan.y=p.y+(u.y-p.y)*t),a){const i=o+(r-o)*t;h.setZoomLevel(i)}h.applyCurrentZoomPan()}l&&s.bgOpacity<1&&s.applyBgOpacity(n(c+(1-c)*t,0,1))},onComplete:()=>{h.g(r),h.applyCurrentZoomPan()}})}}function P(t){return!!t.target.closest(".pswp__container")}class C{constructor(t){this.gestures=t}click(t,i){const s=i.target.classList,h=s.contains("pswp__img"),e=s.contains("pswp__item")||s.contains("pswp__zoom-wrap");h?this.k("imageClick",t,i):e&&this.k("bgClick",t,i)}tap(t,i){P(i)&&this.k("tap",t,i)}doubleTap(t,i){P(i)&&this.k("doubleTap",t,i)}k(t,i,s){const{pswp:h}=this.gestures,{currSlide:e}=h,n=t+"Action",o=h.options[n];if(!h.dispatch(n,{point:i,originalEvent:s}).defaultPrevented)if("function"!=typeof o)switch(o){case"close":case"next":h[o]();break;case"zoom":e.toggleZoom(i);break;case"zoom-or-close":e.isZoomable()&&e.zoomLevels.secondary!==e.zoomLevels.initial?e.toggleZoom(i):h.options.clickToCloseNonZoomable&&h.close();break;case"toggle-controls":this.gestures.pswp.element.classList.toggle("pswp--ui-visible")}else o.call(h,i,s)}}class T{constructor(t){this.pswp=t,this.dragAxis=void 0,this.p1={},this.p2={},this.prevP1={},this.prevP2={},this.startP1={},this.startP2={},this.velocity={},this.Z={},this.F={},this.O=0,this.B=[],this.R="ontouchstart"in window,this.N=!!window.PointerEvent,this.supportsTouch=this.R||this.N&&navigator.maxTouchPoints>1,this.supportsTouch||(t.options.allowPanToNext=!1),this.drag=new x(this),this.zoomLevels=new z(this),this.tapHandler=new C(this),t.on("bindEvents",(()=>{t.events.add(t.scrollWrap,"click",(t=>this.V(t))),this.N?this.G("pointer","down","up","cancel"):this.R?(this.G("touch","start","end","cancel"),t.scrollWrap.ontouchmove=()=>{},t.scrollWrap.ontouchend=()=>{}):this.G("mouse","down","up")}))}G(t,i,s,h){const{pswp:e}=this,{events:n}=e,o=h?t+h:"";n.add(e.scrollWrap,t+i,this.onPointerDown.bind(this)),n.add(window,t+"move",this.onPointerMove.bind(this)),n.add(window,t+s,this.onPointerUp.bind(this)),o&&n.add(e.scrollWrap,o,this.onPointerUp.bind(this))}onPointerDown(t){let s;if("mousedown"!==t.type&&"mouse"!==t.pointerType||(s=!0),s&&t.button>0)return;const{pswp:h}=this;h.opener.isOpen?h.dispatch("pointerDown",{originalEvent:t}).defaultPrevented||(s&&(h.mouseDetected(),this.U(t)),h.animations.stopAll(),this.q(t,"down"),this.pointerDown=!0,1===this.O&&(this.dragAxis=null,i(this.startP1,this.p1)),this.O>1?(this.H(),this.isMultitouch=!0):this.isMultitouch=!1):t.preventDefault()}onPointerMove(t){t.preventDefault(),this.O&&(this.q(t,"move"),this.pswp.dispatch("pointerMove",{originalEvent:t}).defaultPrevented||(1!==this.O||this.isDragging?this.O>1&&!this.isZooming&&(this.K(),this.isZooming=!0,this.W(),this.zoomLevels.start(),this.j(),this.X()):(this.dragAxis||this.Y(),this.dragAxis&&!this.isDragging&&(this.isZooming&&(this.isZooming=!1,this.zoomLevels.end()),this.isDragging=!0,this.H(),this.W(),this.$=Date.now(),this.J=!1,i(this.F,this.p1),this.velocity.x=0,this.velocity.y=0,this.drag.start(),this.j(),this.X()))))}K(){this.isDragging&&(this.isDragging=!1,this.J||this.tt(!0),this.drag.end(),this.dragAxis=null)}onPointerUp(t){this.O&&(this.q(t,"up"),this.pswp.dispatch("pointerUp",{originalEvent:t}).defaultPrevented||(0===this.O&&(this.pointerDown=!1,this.j(),this.isDragging?this.K():this.isZooming||this.isMultitouch||this.it(t)),this.O<2&&this.isZooming&&(this.isZooming=!1,this.zoomLevels.end(),1===this.O&&(this.dragAxis=null,this.W()))))}X(){(this.isDragging||this.isZooming)&&(this.tt(),this.isDragging?e(this.p1,this.prevP1)||this.drag.change():e(this.p1,this.prevP1)&&e(this.p2,this.prevP2)||this.zoomLevels.change(),this.st(),this.raf=requestAnimationFrame(this.X.bind(this)))}tt(t){const s=Date.now(),h=s-this.$;h<50&&!t||(this.velocity.x=this.ht("x",h),this.velocity.y=this.ht("y",h),this.$=s,i(this.F,this.p1),this.J=!0)}it(t){const{mainScroll:s}=this.pswp;if(s.isShifted())return void s.moveIndexBy(0,!0);if(t.type.indexOf("cancel")>0)return;if("mouseup"===t.type||"mouse"===t.pointerType)return void this.tapHandler.click(this.startP1,t);const e=this.pswp.options.doubleTapAction?300:0;this.et?(this.H(),h(this.Z,this.startP1)<25&&this.tapHandler.doubleTap(this.startP1,t)):(i(this.Z,this.startP1),this.et=setTimeout((()=>{this.tapHandler.tap(this.startP1,t),this.H()}),e))}H(){this.et&&(clearTimeout(this.et),this.et=null)}ht(t,i){const s=this.p1[t]-this.F[t];return Math.abs(s)>1&&i>5?s/i:0}j(){this.raf&&(cancelAnimationFrame(this.raf),this.raf=null)}U(t){return t.preventDefault(),!0}q(t,s){if(this.N){const h=t,e=this.B.findIndex((t=>t.id===h.pointerId));"up"===s&&e>-1?this.B.splice(e,1):"down"===s&&-1===e?this.B.push(this.nt(h,{})):e>-1&&this.nt(h,this.B[e]),this.O=this.B.length,this.O>0&&i(this.p1,this.B[0]),this.O>1&&i(this.p2,this.B[1])}else{const i=t;this.O=0,i.type.indexOf("touch")>-1?i.touches&&i.touches.length>0&&(this.nt(i.touches[0],this.p1),this.O++,i.touches.length>1&&(this.nt(i.touches[1],this.p2),this.O++)):(this.nt(t,this.p1),"up"===s?this.O=0:this.O++)}}st(){i(this.prevP1,this.p1),i(this.prevP2,this.p2)}W(){i(this.startP1,this.p1),i(this.startP2,this.p2),this.st()}Y(){if(this.pswp.mainScroll.isShifted())this.dragAxis="x";else{const t=Math.abs(this.p1.x-this.startP1.x)-Math.abs(this.p1.y-this.startP1.y);if(0!==t){const i=t>0?"x":"y";Math.abs(this.p1[i]-this.startP1[i])>=10&&(this.dragAxis=i)}}}nt(t,i){return i.x=t.pageX-this.pswp.offset.x,i.y=t.pageY-this.pswp.offset.y,"pointerId"in t?i.id=t.pointerId:void 0!==t.identifier&&(i.id=t.identifier),i}V(t){this.pswp.mainScroll.isShifted()&&(t.preventDefault(),t.stopPropagation())}}class D{constructor(t){this.pswp=t,this.x=0,this.slideWidth=void 0,this.itemHolders=void 0,this.resetPosition()}resize(t){const{pswp:i}=this,s=Math.round(i.viewportSize.x+i.viewportSize.x*i.options.spacing),h=s!==this.slideWidth;h&&(this.slideWidth=s,this.moveTo(this.getCurrSlideX())),this.itemHolders.forEach(((i,s)=>{h&&r(i.el,(s+this.ot)*this.slideWidth),t&&i.slide&&i.slide.resize()}))}resetPosition(){this.rt=0,this.ct=0,this.slideWidth=0,this.ot=-1}appendHolders(){this.itemHolders=[];for(let i=0;i<3;i++){const s=t("pswp__item",!1,this.pswp.container);s.setAttribute("role","group"),s.setAttribute("aria-roledescription","slide"),s.setAttribute("aria-hidden","true"),s.style.display=1===i?"block":"none",this.itemHolders.push({el:s})}}canBeSwiped(){return this.pswp.getNumItems()>1}moveIndexBy(t,i,s){const{pswp:h}=this;let e=h.potentialIndex+t;const n=h.getNumItems();if(h.canLoop()){e=h.getLoopedIndex(e);const i=(t+n)%n;t=i<=n/2?i:i-n}else e<0?e=0:e>=n&&(e=n-1),t=e-h.potentialIndex;h.potentialIndex=e,this.rt-=t,h.animations.stopMainScroll();const o=this.getCurrSlideX();if(i){h.animations.startSpring({isMainScroll:!0,start:this.x,end:o,velocity:s||0,naturalFrequency:30,dampingRatio:1,onUpdate:t=>{this.moveTo(t)},onComplete:()=>{this.updateCurrItem(),h.appendHeavy()}});let t=h.potentialIndex-h.currIndex;if(h.canLoop()){const i=(t+n)%n;t=i<=n/2?i:i-n}Math.abs(t)>1&&this.updateCurrItem()}else this.moveTo(o),this.updateCurrItem();if(t)return!0}getCurrSlideX(){return this.slideWidth*this.rt}isShifted(){return this.x!==this.getCurrSlideX()}updateCurrItem(){const{pswp:t}=this,i=this.ct-this.rt;if(!i)return;this.ct=this.rt,t.currIndex=t.potentialIndex;let s,h=Math.abs(i);h>=3&&(this.ot+=i+(i>0?-3:3),h=3);for(let e=0;e<h;e++)i>0?(s=this.itemHolders.shift(),this.itemHolders[2]=s,this.ot++,r(s.el,(this.ot+2)*this.slideWidth),t.setContent(s,t.currIndex-h+e+2)):(s=this.itemHolders.pop(),this.itemHolders.unshift(s),this.ot--,r(s.el,this.ot*this.slideWidth),t.setContent(s,t.currIndex+h-e-2));Math.abs(this.ot)>50&&!this.isShifted()&&(this.resetPosition(),this.resize()),t.animations.stopAllPan(),this.itemHolders.forEach(((t,i)=>{t.slide&&t.slide.setIsActive(1===i)})),t.currSlide=this.itemHolders[1].slide,t.contentLoader.updateLazy(i),t.currSlide&&t.currSlide.applyCurrentZoomPan(),t.dispatch("change")}moveTo(t,i){let s,h;!this.pswp.canLoop()&&i&&(s=(this.slideWidth*this.rt-t)/this.slideWidth,s+=this.pswp.currIndex,h=Math.round(t-this.x),(s<0&&h>0||s>=this.pswp.getNumItems()-1&&h<0)&&(t=this.x+.35*h)),this.x=t,r(this.pswp.container,t),this.pswp.dispatch("moveMainScroll",{x:t,dragging:i})}}class I{constructor(t){this.pswp=t,t.on("bindEvents",(()=>{t.options.initialPointerPos||this.lt(),t.events.add(document,"focusin",this.ut.bind(this)),t.events.add(document,"keydown",this.dt.bind(this))}));const i=document.activeElement;t.on("destroy",(()=>{t.options.returnFocus&&i&&this.ft&&i.focus()}))}lt(){this.ft||(this.pswp.element.focus(),this.ft=!0)}dt(t){const{pswp:i}=this;if(i.dispatch("keydown",{originalEvent:t}).defaultPrevented)return;if(function(t){if(2===t.which||t.ctrlKey||t.metaKey||t.altKey||t.shiftKey)return!0}(t))return;let s,h,e;switch(t.keyCode){case 27:i.options.escKey&&(s="close");break;case 90:s="toggleZoom";break;case 37:h="x";break;case 38:h="y";break;case 39:h="x",e=!0;break;case 40:e=!0,h="y";break;case 9:this.lt()}if(h){t.preventDefault();const{currSlide:n}=i;i.options.arrowKeys&&"x"===h&&i.getNumItems()>1?s=e?"next":"prev":n&&n.currZoomLevel>n.zoomLevels.fit&&(n.pan[h]+=e?-80:80,n.panTo(n.pan.x,n.pan.y))}s&&(t.preventDefault(),i[s]())}ut(t){const{template:i}=this.pswp;document===t.target||i===t.target||i.contains(t.target)||i.focus()}}class A{constructor(t){this.props=t;const{target:i,onComplete:s,transform:h,onFinish:e}=t;let{duration:n,easing:o}=t;this.onFinish=e;const r=h?"transform":"opacity",c=t[r];this.wt=i,this.gt=s,n=n||333,o=o||"cubic-bezier(.4,0,.22,1)",this._t=this._t.bind(this),this.vt=setTimeout((()=>{a(i,r,n,o),this.vt=setTimeout((()=>{i.addEventListener("transitionend",this._t,!1),i.addEventListener("transitioncancel",this._t,!1),this.vt=setTimeout((()=>{this.yt()}),n+500),i.style[r]=c}),30)}),0)}_t(t){t.target===this.wt&&this.yt()}yt(){this.bt||(this.bt=!0,this.onFinish(),this.gt&&this.gt())}destroy(){this.vt&&clearTimeout(this.vt),a(this.wt),this.wt.removeEventListener("transitionend",this._t,!1),this.wt.removeEventListener("transitioncancel",this._t,!1),this.bt||this.yt()}}class E{constructor(t,i,s){this.velocity=1e3*t,this.St=i||.75,this.xt=s||12,this.St<1&&(this.Mt=this.xt*Math.sqrt(1-this.St*this.St))}easeFrame(t,i){let s,h=0;i/=1e3;const e=Math.E**(-this.St*this.xt*i);if(1===this.St)s=this.velocity+this.xt*t,h=(t+s*i)*e,this.velocity=h*-this.xt+s*e;else if(this.St<1){s=1/this.Mt*(this.St*this.xt*t+this.velocity);const n=Math.cos(this.Mt*i),o=Math.sin(this.Mt*i);h=e*(t*n+s*o),this.velocity=h*-this.xt*this.St+e*(-this.Mt*t*o+this.Mt*s*n)}return h}}class L{constructor(t){this.props=t;const{start:i,end:s,velocity:h,onUpdate:e,onComplete:n,onFinish:o,dampingRatio:r,naturalFrequency:a}=t;this.onFinish=o;const c=new E(h,r,a);let l=Date.now(),p=i-s;const u=()=>{this.zt&&(p=c.easeFrame(p,Date.now()-l),Math.abs(p)<1&&Math.abs(c.velocity)<50?(e(s),n&&n(),this.onFinish()):(l=Date.now(),e(p+s),this.zt=requestAnimationFrame(u)))};this.zt=requestAnimationFrame(u)}destroy(){this.zt>=0&&cancelAnimationFrame(this.zt),this.zt=null}}class k{constructor(){this.activeAnimations=[]}startSpring(t){this.Pt(t,!0)}startTransition(t){this.Pt(t)}Pt(t,i){let s;return s=i?new L(t):new A(t),this.activeAnimations.push(s),s.onFinish=()=>this.stop(s),s}stop(t){t.destroy();const i=this.activeAnimations.indexOf(t);i>-1&&this.activeAnimations.splice(i,1)}stopAll(){this.activeAnimations.forEach((t=>{t.destroy()})),this.activeAnimations=[]}stopAllPan(){this.activeAnimations=this.activeAnimations.filter((t=>!t.props.isPan||(t.destroy(),!1)))}stopMainScroll(){this.activeAnimations=this.activeAnimations.filter((t=>!t.props.isMainScroll||(t.destroy(),!1)))}isPanRunning(){return this.activeAnimations.some((t=>t.props.isPan))}}class Z{constructor(t){this.pswp=t,t.events.add(t.element,"wheel",this.Ct.bind(this))}Ct(t){t.preventDefault();const{currSlide:i}=this.pswp;let{deltaX:s,deltaY:h}=t;if(i&&!this.pswp.dispatch("wheel",{originalEvent:t}).defaultPrevented)if(t.ctrlKey||this.pswp.options.wheelToZoom){if(i.isZoomable()){let s=-h;1===t.deltaMode?s*=.05:s*=t.deltaMode?1:.002,s=2**s;const e=i.currZoomLevel*s;i.zoomTo(e,{x:t.clientX,y:t.clientY})}}else i.isPannable()&&(1===t.deltaMode&&(s*=18,h*=18),i.panTo(i.pan.x-s,i.pan.y-h))}}class F{constructor(i,s){const h=s.name||s.className;let e=s.html;if(!1===i.options[h])return;"string"==typeof i.options[h+"SVG"]&&(e=i.options[h+"SVG"]),i.dispatch("uiElementCreate",{data:s});let n,o="";s.isButton?(o+="pswp__button ",o+=s.className||`pswp__button--${s.name}`):o+=s.className||`pswp__${s.name}`;let r=s.isButton?s.tagName||"button":s.tagName||"div";if(r=r.toLowerCase(),n=t(o,r),s.isButton){n=t(o,r),"button"===r&&(n.type="button");let{title:e}=s;const{ariaLabel:a}=s;"string"==typeof i.options[h+"Title"]&&(e=i.options[h+"Title"]),e&&(n.title=e),(a||e)&&n.setAttribute("aria-label",a||e)}n.innerHTML=function(t){if("string"==typeof t)return t;if(!t||!t.isCustomSVG)return"";const i=t;let s='<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 %d %d" width="%d" height="%d">';return s=s.split("%d").join(i.size||32),i.outlineID&&(s+='<use class="pswp__icn-shadow" xlink:href="#'+i.outlineID+'"/>'),s+=i.inner,s+="</svg>",s}(e),s.onInit&&s.onInit(n,i),s.onClick&&(n.onclick=t=>{"string"==typeof s.onClick?i[s.onClick]():s.onClick(t,n,i)});const a=s.appendTo||"bar";let c;"bar"===a?(i.topBar||(i.topBar=t("pswp__top-bar pswp__hide-on-close","div",i.scrollWrap)),c=i.topBar):(n.classList.add("pswp__hide-on-close"),c="wrapper"===a?i.scrollWrap:i.element),c.appendChild(i.applyFilters("uiElement",n,s))}}function O(t,i,s){t.classList.add("pswp__button--arrow"),t.setAttribute("aria-controls","pswp__items"),i.on("change",(()=>{i.options.loop||(t.disabled=s?!(i.currIndex<i.getNumItems()-1):!(i.currIndex>0))}))}const B={name:"arrowPrev",className:"pswp__button--arrow--prev",title:"Previous",order:10,isButton:!0,appendTo:"wrapper",html:{isCustomSVG:!0,size:60,inner:'<path d="M29 43l-3 3-16-16 16-16 3 3-13 13 13 13z" id="pswp__icn-arrow"/>',outlineID:"pswp__icn-arrow"},onClick:"prev",onInit:O},R={name:"arrowNext",className:"pswp__button--arrow--next",title:"Next",order:11,isButton:!0,appendTo:"wrapper",html:{isCustomSVG:!0,size:60,inner:'<use xlink:href="#pswp__icn-arrow"/>',outlineID:"pswp__icn-arrow"},onClick:"next",onInit:(t,i)=>{O(t,i,!0)}},N={name:"close",title:"Close",order:20,isButton:!0,html:{isCustomSVG:!0,inner:'<path d="M24 10l-2-2-6 6-6-6-2 2 6 6-6 6 2 2 6-6 6 6 2-2-6-6z" id="pswp__icn-close"/>',outlineID:"pswp__icn-close"},onClick:"close"},V={name:"zoom",title:"Zoom",order:10,isButton:!0,html:{isCustomSVG:!0,inner:'<path d="M17.426 19.926a6 6 0 1 1 1.5-1.5L23 22.5 21.5 24l-4.074-4.074z" id="pswp__icn-zoom"/><path fill="currentColor" class="pswp__zoom-icn-bar-h" d="M11 16v-2h6v2z"/><path fill="currentColor" class="pswp__zoom-icn-bar-v" d="M13 12h2v6h-2z"/>',outlineID:"pswp__icn-zoom"},onClick:"toggleZoom"},G={name:"preloader",appendTo:"bar",order:7,html:{isCustomSVG:!0,inner:'<path fill-rule="evenodd" clip-rule="evenodd" d="M21.2 16a5.2 5.2 0 1 1-5.2-5.2V8a8 8 0 1 0 8 8h-2.8Z" id="pswp__icn-loading"/>',outlineID:"pswp__icn-loading"},onInit:(t,i)=>{let s,h;const e=i=>{var h,e;s!==i&&(s=i,h="active",e=i,t.classList[e?"add":"remove"]("pswp__preloader--"+h))},n=()=>{if(!i.currSlide.content.isLoading())return e(!1),void(h&&(clearTimeout(h),h=null));h||(h=setTimeout((()=>{e(i.currSlide.content.isLoading()),h=null}),i.options.preloaderDelay))};i.on("change",n),i.on("loadComplete",(t=>{i.currSlide===t.slide&&n()})),i.ui.updatePreloaderVisibility=n}},U={name:"counter",order:5,onInit:(t,i)=>{i.on("change",(()=>{t.innerText=i.currIndex+1+i.options.indexIndicatorSep+i.getNumItems()}))}};function q(t,i){t.classList[i?"add":"remove"]("pswp--zoomed-in")}class H{constructor(t){this.pswp=t,this.updatePreloaderVisibility=void 0,this.Tt=void 0}init(){const{pswp:t}=this;this.isRegistered=!1,this.uiElementsData=[N,B,R,V,G,U],t.dispatch("uiRegister"),this.uiElementsData.sort(((t,i)=>(t.order||0)-(i.order||0))),this.items=[],this.isRegistered=!0,this.uiElementsData.forEach((t=>{this.registerElement(t)})),t.on("change",(()=>{t.element.classList[1===t.getNumItems()?"add":"remove"]("pswp--one-slide")})),t.on("zoomPanUpdate",(()=>this.Dt()))}registerElement(t){this.isRegistered?this.items.push(new F(this.pswp,t)):this.uiElementsData.push(t)}Dt(){const{template:t,currSlide:i,options:s}=this.pswp;let{currZoomLevel:h}=i;if(this.pswp.opener.isClosing)return;if(this.pswp.opener.isOpen||(h=i.zoomLevels.initial),h===this.Tt)return;this.Tt=h;const e=i.zoomLevels.initial-i.zoomLevels.secondary;if(Math.abs(e)<.01||!i.isZoomable())return q(t,!1),void t.classList.remove("pswp--zoom-allowed");t.classList.add("pswp--zoom-allowed");q(t,(h===i.zoomLevels.initial?i.zoomLevels.secondary:i.zoomLevels.initial)<=h),"zoom"!==s.imageClickAction&&"zoom-or-close"!==s.imageClickAction||t.classList.add("pswp--click-to-zoom")}}class K{constructor(t,i){this.type=t,i&&Object.assign(this,i)}preventDefault(){this.defaultPrevented=!0}}class W{constructor(i,s){this.element=t("pswp__img pswp__img--placeholder",i?"img":"",s),i&&(this.element.decoding="async",this.element.alt="",this.element.src=i,this.element.setAttribute("role","presentation")),this.element.setAttribute("aria-hidden","true")}setDisplayedSize(t,i){this.element&&("IMG"===this.element.tagName?(c(this.element,250,"auto"),this.element.style.transformOrigin="0 0",this.element.style.transform=o(0,0,t/250)):c(this.element,t,i))}destroy(){this.element.parentNode&&this.element.remove(),this.element=null}}class j{constructor(t,i,s){this.instance=i,this.data=t,this.index=s,this.element=void 0,this.displayedImageWidth=0,this.displayedImageHeight=0,this.width=Number(this.data.w)||Number(this.data.width)||0,this.height=Number(this.data.h)||Number(this.data.height)||0,this.isAttached=!1,this.hasSlide=!1,this.state=l,this.data.type?this.type=this.data.type:this.data.src?this.type="image":this.type="html",this.instance.dispatch("contentInit",{content:this})}removePlaceholder(){this.placeholder&&!this.keepPlaceholder()&&setTimeout((()=>{this.placeholder&&(this.placeholder.destroy(),this.placeholder=null)}),1e3)}load(i,s){if(this.slide&&this.usePlaceholder())if(this.placeholder){const t=this.placeholder.element;t&&!t.parentElement&&this.slide.container.prepend(t)}else{const t=this.instance.applyFilters("placeholderSrc",!(!this.data.msrc||!this.slide.isFirstSlide)&&this.data.msrc,this);this.placeholder=new W(t,this.slide.container)}this.element&&!s||this.instance.dispatch("contentLoad",{content:this,isLazy:i}).defaultPrevented||(this.isImageContent()?(this.element=t("pswp__img","img"),this.displayedImageWidth&&this.loadImage(i)):(this.element=t("pswp__content"),this.element.innerHTML=this.data.html||""),s&&this.slide&&this.slide.updateContentSize(!0))}loadImage(t){const i=this.element;this.instance.dispatch("contentLoadImage",{content:this,isLazy:t}).defaultPrevented||(this.updateSrcsetSizes(),this.data.srcset&&(i.srcset=this.data.srcset),i.src=this.data.src,i.alt=this.data.alt||"",this.state=p,i.complete?this.onLoaded():(i.onload=()=>{this.onLoaded()},i.onerror=()=>{this.onError()}))}setSlide(t){this.slide=t,this.hasSlide=!0,this.instance=t.pswp}onLoaded(){this.state=u,this.slide&&(this.instance.dispatch("loadComplete",{slide:this.slide,content:this}),this.slide.isActive&&this.slide.heavyAppended&&!this.element.parentNode&&(this.append(),this.slide.updateContentSize(!0)),this.state!==u&&this.state!==d||this.removePlaceholder())}onError(){this.state=d,this.slide&&(this.displayError(),this.instance.dispatch("loadComplete",{slide:this.slide,isError:!0,content:this}),this.instance.dispatch("loadError",{slide:this.slide,content:this}))}isLoading(){return this.instance.applyFilters("isContentLoading",this.state===p,this)}isError(){return this.state===d}isImageContent(){return"image"===this.type}setDisplayedSize(t,i){if(this.element&&(this.placeholder&&this.placeholder.setDisplayedSize(t,i),!this.instance.dispatch("contentResize",{content:this,width:t,height:i}).defaultPrevented&&(c(this.element,t,i),this.isImageContent()&&!this.isError()))){const s=!this.displayedImageWidth&&t;this.displayedImageWidth=t,this.displayedImageHeight=i,s?this.loadImage(!1):this.updateSrcsetSizes(),this.slide&&this.instance.dispatch("imageSizeChange",{slide:this.slide,width:t,height:i,content:this})}}isZoomable(){return this.instance.applyFilters("isContentZoomable",this.isImageContent()&&this.state!==d,this)}updateSrcsetSizes(){if(this.data.srcset){const t=this.element,i=this.instance.applyFilters("srcsetSizesWidth",this.displayedImageWidth,this);(!t.dataset.largestUsedSize||i>parseInt(t.dataset.largestUsedSize,10))&&(t.sizes=i+"px",t.dataset.largestUsedSize=String(i))}}usePlaceholder(){return this.instance.applyFilters("useContentPlaceholder",this.isImageContent(),this)}lazyLoad(){this.instance.dispatch("contentLazyLoad",{content:this}).defaultPrevented||this.load(!0)}keepPlaceholder(){return this.instance.applyFilters("isKeepingPlaceholder",this.isLoading(),this)}destroy(){this.hasSlide=!1,this.slide=null,this.instance.dispatch("contentDestroy",{content:this}).defaultPrevented||(this.remove(),this.placeholder&&(this.placeholder.destroy(),this.placeholder=null),this.isImageContent()&&this.element&&(this.element.onload=null,this.element.onerror=null,this.element=null))}displayError(){if(this.slide){let i=t("pswp__error-msg");i.innerText=this.instance.options.errorMsg,i=this.instance.applyFilters("contentErrorElement",i,this),this.element=t("pswp__content pswp__error-msg-container"),this.element.appendChild(i),this.slide.container.innerText="",this.slide.container.appendChild(this.element),this.slide.updateContentSize(!0),this.removePlaceholder()}}append(){if(this.isAttached)return;if(this.isAttached=!0,this.state===d)return void this.displayError();if(this.instance.dispatch("contentAppend",{content:this}).defaultPrevented)return;const t="decode"in this.element;this.isImageContent()?t&&this.slide&&(!this.slide.isActive||m())?(this.isDecoding=!0,this.element.decode().catch((()=>{})).finally((()=>{this.isDecoding=!1,this.appendImage()}))):this.appendImage():this.element&&!this.element.parentNode&&this.slide.container.appendChild(this.element)}activate(){this.instance.dispatch("contentActivate",{content:this}).defaultPrevented||this.slide&&(this.isImageContent()&&this.isDecoding&&!m()?this.appendImage():this.isError()&&this.load(!1,!0),this.slide.holderElement&&this.slide.holderElement.setAttribute("aria-hidden","false"))}deactivate(){this.instance.dispatch("contentDeactivate",{content:this}),this.slide&&this.slide.holderElement&&this.slide.holderElement.setAttribute("aria-hidden","true")}remove(){this.isAttached=!1,this.instance.dispatch("contentRemove",{content:this}).defaultPrevented||(this.element&&this.element.parentNode&&this.element.remove(),this.placeholder&&this.placeholder.element&&this.placeholder.element.remove())}appendImage(){this.isAttached&&(this.instance.dispatch("contentAppendImage",{content:this}).defaultPrevented||(this.slide&&this.element&&!this.element.parentNode&&this.slide.container.appendChild(this.element),this.state!==u&&this.state!==d||this.removePlaceholder()))}}function X(t,i,s){const h=i.createContentFromData(t,s);if(!h||!h.lazyLoad)return;const{options:e}=i,n=v(e,i.viewportSize||g(e,i),t,s),o=new b(e,t,-1);return o.update(h.width,h.height,n),h.lazyLoad(),h.setDisplayedSize(Math.ceil(h.width*o.initial),Math.ceil(h.height*o.initial)),h}class Y{constructor(t){this.pswp=t,this.limit=Math.max(t.options.preload[0]+t.options.preload[1]+1,5),this.It=[]}updateLazy(t){const{pswp:i}=this;if(i.dispatch("lazyLoad").defaultPrevented)return;const{preload:s}=i.options,h=void 0===t||t>=0;let e;for(e=0;e<=s[1];e++)this.loadSlideByIndex(i.currIndex+(h?e:-e));for(e=1;e<=s[0];e++)this.loadSlideByIndex(i.currIndex+(h?-e:e))}loadSlideByIndex(t){t=this.pswp.getLoopedIndex(t);let i=this.getContentByIndex(t);i||(i=function(t,i){const s=i.getItemData(t);if(!i.dispatch("lazyLoadSlide",{index:t,itemData:s}).defaultPrevented)return X(s,i,t)}(t,this.pswp),i&&this.addToCache(i))}getContentBySlide(t){let i=this.getContentByIndex(t.index);return i||(i=this.pswp.createContentFromData(t.data,t.index),i&&this.addToCache(i)),i&&i.setSlide(t),i}addToCache(t){if(this.removeByIndex(t.index),this.It.push(t),this.It.length>this.limit){const t=this.It.findIndex((t=>!t.isAttached&&!t.hasSlide));if(-1!==t){this.It.splice(t,1)[0].destroy()}}}removeByIndex(t){const i=this.It.findIndex((i=>i.index===t));-1!==i&&this.It.splice(i,1)}getContentByIndex(t){return this.It.find((i=>i.index===t))}destroy(){this.It.forEach((t=>t.destroy())),this.It=null}}const $=.003;class J{constructor(t){this.pswp=t,this.isClosed=!0,this.At=this.At.bind(this),this.Et=void 0,t.on("firstZoomPan",this.At)}open(){this.At(),this.Pt()}close(){if(this.isClosed||this.isClosing||this.isOpening)return!1;const t=this.pswp.currSlide;return this.isOpen=!1,this.isOpening=!1,this.isClosing=!0,this.Lt=this.pswp.options.hideAnimationDuration,t&&t.currZoomLevel*t.width>=this.pswp.options.maxWidthToAnimate&&(this.Lt=0),this.kt(),setTimeout((()=>{this.Pt()}),this.Zt?30:0),!0}At(){if(this.pswp.off("firstZoomPan",this.At),!this.isOpening){const t=this.pswp.currSlide;this.isOpening=!0,this.isClosing=!1,this.Lt=this.pswp.options.showAnimationDuration,t&&t.zoomLevels.initial*t.width>=this.pswp.options.maxWidthToAnimate&&(this.Lt=0),this.kt()}}kt(){const{pswp:t}=this,i=this.pswp.currSlide,{options:s}=t;if("fade"===s.showHideAnimationType?(s.showHideOpacity=!0,this.Et=!1):"none"===s.showHideAnimationType?(s.showHideOpacity=!1,this.Lt=0,this.Et=!1):this.isOpening&&t.Ft?this.Et=t.Ft:this.Et=this.pswp.getThumbBounds(),this.Ot=i.getPlaceholderElement(),t.animations.stopAll(),this.Bt=this.Lt>50,this.Rt=Boolean(this.Et)&&i.content&&i.content.usePlaceholder()&&(!this.isClosing||!t.mainScroll.isShifted()),this.Rt?this.Nt=s.showHideOpacity:(this.Nt=!0,this.isOpening&&(i.zoomAndPanToInitial(),i.applyCurrentZoomPan())),this.Vt=!this.Nt&&this.pswp.options.bgOpacity>$,this.Gt=this.Nt?t.element:t.bg,!this.Bt)return this.Lt=0,this.Rt=!1,this.Vt=!1,this.Nt=!0,void(this.isOpening&&(t.element.style.opacity=String($),t.applyBgOpacity(1)));this.Rt&&this.Et&&this.Et.innerRect?(this.Zt=!0,this.Ut=this.pswp.container,this.qt=this.pswp.currSlide.holderElement,t.container.style.overflow="hidden",t.container.style.width=t.viewportSize.x+"px"):this.Zt=!1,this.isOpening?(this.Nt?(t.element.style.opacity=String($),t.applyBgOpacity(1)):(this.Vt&&(t.bg.style.opacity=String($)),t.element.style.opacity="1"),this.Rt&&(this.Ht(),this.Ot&&(this.Ot.style.willChange="transform",this.Ot.style.opacity=String($)))):this.isClosing&&(t.mainScroll.itemHolders[0].el.style.display="none",t.mainScroll.itemHolders[2].el.style.display="none",this.Zt&&0!==t.mainScroll.x&&(t.mainScroll.resetPosition(),t.mainScroll.resize()))}Pt(){this.isOpening&&this.Bt&&this.Ot&&"IMG"===this.Ot.tagName?new Promise((t=>{let i=!1,s=!0;var h;(h=this.Ot,"decode"in h?h.decode().catch((()=>{})):h.complete?Promise.resolve(h):new Promise(((t,i)=>{h.onload=()=>t(h),h.onerror=i}))).finally((()=>{i=!0,s||t()})),setTimeout((()=>{s=!1,i&&t()}),50),setTimeout(t,250)})).finally((()=>this.Kt())):this.Kt()}Kt(){this.pswp.element.style.setProperty("--pswp-transition-duration",this.Lt+"ms"),this.pswp.dispatch(this.isOpening?"openingAnimationStart":"closingAnimationStart"),this.pswp.dispatch("initialZoom"+(this.isOpening?"In":"Out")),this.pswp.element.classList[this.isOpening?"add":"remove"]("pswp--ui-visible"),this.isOpening?(this.Ot&&(this.Ot.style.opacity="1"),this.Wt()):this.isClosing&&this.jt(),this.Bt||this.Xt()}Xt(){const{pswp:t}=this;this.isOpen=this.isOpening,this.isClosed=this.isClosing,this.isOpening=!1,this.isClosing=!1,t.dispatch(this.isOpen?"openingAnimationEnd":"closingAnimationEnd"),t.dispatch("initialZoom"+(this.isOpen?"InEnd":"OutEnd")),this.isClosed?t.destroy():this.isOpen&&(this.Rt&&(t.container.style.overflow="visible",t.container.style.width="100%"),t.currSlide.applyCurrentZoomPan())}Wt(){const{pswp:t}=this;this.Rt&&(this.Zt&&(this.Yt(this.Ut,"transform","translate3d(0,0,0)"),this.Yt(this.qt,"transform","none")),t.currSlide.zoomAndPanToInitial(),this.Yt(t.currSlide.container,"transform",t.currSlide.getCurrentTransform())),this.Vt&&this.Yt(t.bg,"opacity",String(t.options.bgOpacity)),this.Nt&&this.Yt(t.element,"opacity","1")}jt(){const{pswp:t}=this;this.Rt&&this.Ht(!0),this.Vt&&t.bgOpacity>.01&&this.Yt(t.bg,"opacity","0"),this.Nt&&this.Yt(t.element,"opacity","0")}Ht(t){if(!this.Et)return;const{pswp:s}=this,{innerRect:h}=this.Et,{currSlide:e,viewportSize:n}=s;if(this.Zt){const i=-n.x+(this.Et.x-h.x)+h.w,s=-n.y+(this.Et.y-h.y)+h.h,e=n.x-h.w,a=n.y-h.h;t?(this.Yt(this.Ut,"transform",o(i,s)),this.Yt(this.qt,"transform",o(e,a))):(r(this.Ut,i,s),r(this.qt,e,a))}i(e.pan,h||this.Et),e.currZoomLevel=this.Et.w/e.width,t?this.Yt(e.container,"transform",e.getCurrentTransform()):e.applyCurrentZoomPan()}Yt(t,i,s){if(!this.Lt)return void(t.style[i]=s);const{animations:h}=this.pswp,e={duration:this.Lt,easing:this.pswp.options.easing,onComplete:()=>{h.activeAnimations.length||this.Xt()},target:t};e[i]=s,h.startTransition(e)}}const Q={allowPanToNext:!0,spacing:.1,loop:!0,pinchToClose:!0,closeOnVerticalDrag:!0,hideAnimationDuration:333,showAnimationDuration:333,zoomAnimationDuration:333,escKey:!0,arrowKeys:!0,returnFocus:!0,maxWidthToAnimate:4e3,clickToCloseNonZoomable:!0,imageClickAction:"zoom-or-close",bgClickAction:"close",tapAction:"toggle-controls",doubleTapAction:"zoom",indexIndicatorSep:" / ",preloaderDelay:2e3,bgOpacity:.8,index:0,errorMsg:"The image cannot be loaded",preload:[1,2],easing:"cubic-bezier(.4,0,.22,1)"};return class extends class extends class{constructor(){this.$t={},this.Jt={},this.pswp=void 0,this.options=void 0}addFilter(t,i,s=100){this.Jt[t]||(this.Jt[t]=[]),this.Jt[t].push({fn:i,priority:s}),this.Jt[t].sort(((t,i)=>t.priority-i.priority)),this.pswp&&this.pswp.addFilter(t,i,s)}removeFilter(t,i){this.Jt[t]&&(this.Jt[t]=this.Jt[t].filter((t=>t.fn!==i))),this.pswp&&this.pswp.removeFilter(t,i)}applyFilters(t,...i){return this.Jt[t]&&this.Jt[t].forEach((t=>{i[0]=t.fn.apply(this,i)})),i[0]}on(t,i){this.$t[t]||(this.$t[t]=[]),this.$t[t].push(i),this.pswp&&this.pswp.on(t,i)}off(t,i){this.$t[t]&&(this.$t[t]=this.$t[t].filter((t=>i!==t))),this.pswp&&this.pswp.off(t,i)}dispatch(t,i){if(this.pswp)return this.pswp.dispatch(t,i);const s=new K(t,i);return this.$t?(this.$t[t]&&this.$t[t].forEach((t=>{t.call(this,s)})),s):s}}{getNumItems(){let t;const{dataSource:i}=this.options;i?"length"in i?t=i.length:"gallery"in i&&(i.items||(i.items=this.Qt(i.gallery)),i.items&&(t=i.items.length)):t=0;const s=this.dispatch("numItems",{dataSource:i,numItems:t});return this.applyFilters("numItems",s.numItems,i)}createContentFromData(t,i){return new j(t,this,i)}getItemData(t){const{dataSource:i}=this.options;let s;Array.isArray(i)?s=i[t]:i&&i.gallery&&(i.items||(i.items=this.Qt(i.gallery)),s=i.items[t]);let h=s;h instanceof Element&&(h=this.ti(h));const e=this.dispatch("itemData",{itemData:h||{},index:t});return this.applyFilters("itemData",e.itemData,t)}Qt(t){return this.options.children||this.options.childSelector?function(t,i,s=document){let h=[];if(t instanceof Element)h=[t];else if(t instanceof NodeList||Array.isArray(t))h=Array.from(t);else{const e="string"==typeof t?t:i;e&&(h=Array.from(s.querySelectorAll(e)))}return h}(this.options.children,this.options.childSelector,t)||[]:[t]}ti(t){const i={element:t},s="A"===t.tagName?t:t.querySelector("a");if(s){i.src=s.dataset.pswpSrc||s.href,s.dataset.pswpSrcset&&(i.srcset=s.dataset.pswpSrcset),i.width=parseInt(s.dataset.pswpWidth,10),i.height=parseInt(s.dataset.pswpHeight,10),i.w=i.width,i.h=i.height,s.dataset.pswpType&&(i.type=s.dataset.pswpType);const h=t.querySelector("img");h&&(i.msrc=h.currentSrc||h.src,i.alt=h.getAttribute("alt")),(s.dataset.pswpCropped||s.dataset.cropped)&&(i.thumbCropped=!0)}return this.applyFilters("domItemData",i,t,s)}lazyLoadData(t,i){return X(t,this,i)}}{constructor(t){super(),this.ii(t),this.offset={},this.si={},this.viewportSize={},this.bgOpacity=1,this.topBar=void 0,this.events=new w,this.animations=new k,this.mainScroll=new D(this),this.gestures=new T(this),this.opener=new J(this),this.keyboard=new I(this),this.contentLoader=new Y(this)}init(){if(this.isOpen||this.isDestroying)return;this.isOpen=!0,this.dispatch("init"),this.dispatch("beforeOpen"),this.hi();let t="pswp--open";return this.gestures.supportsTouch&&(t+=" pswp--touch"),this.options.mainClass&&(t+=" "+this.options.mainClass),this.element.className+=" "+t,this.currIndex=this.options.index||0,this.potentialIndex=this.currIndex,this.dispatch("firstUpdate"),this.scrollWheel=new Z(this),(Number.isNaN(this.currIndex)||this.currIndex<0||this.currIndex>=this.getNumItems())&&(this.currIndex=0),this.gestures.supportsTouch||this.mouseDetected(),this.updateSize(),this.offset.y=window.pageYOffset,this.ei=this.getItemData(this.currIndex),this.dispatch("gettingData",{index:this.currIndex,data:this.ei,slide:void 0}),this.Ft=this.getThumbBounds(),this.dispatch("initialLayout"),this.on("openingAnimationEnd",(()=>{this.mainScroll.itemHolders[0].el.style.display="block",this.mainScroll.itemHolders[2].el.style.display="block",this.setContent(this.mainScroll.itemHolders[0],this.currIndex-1),this.setContent(this.mainScroll.itemHolders[2],this.currIndex+1),this.appendHeavy(),this.contentLoader.updateLazy(),this.events.add(window,"resize",this.ni.bind(this)),this.events.add(window,"scroll",this.oi.bind(this)),this.dispatch("bindEvents")})),this.setContent(this.mainScroll.itemHolders[1],this.currIndex),this.dispatch("change"),this.opener.open(),this.dispatch("afterInit"),!0}getLoopedIndex(t){const i=this.getNumItems();return this.options.loop&&(t>i-1&&(t-=i),t<0&&(t+=i)),t=n(t,0,i-1)}appendHeavy(){this.mainScroll.itemHolders.forEach((t=>{t.slide&&t.slide.appendHeavy()}))}goTo(t){this.mainScroll.moveIndexBy(this.getLoopedIndex(t)-this.potentialIndex)}next(){this.goTo(this.potentialIndex+1)}prev(){this.goTo(this.potentialIndex-1)}zoomTo(...t){this.currSlide.zoomTo(...t)}toggleZoom(){this.currSlide.toggleZoom()}close(){this.opener.isOpen&&!this.isDestroying&&(this.isDestroying=!0,this.dispatch("close"),this.events.removeAll(),this.opener.close())}destroy(){if(!this.isDestroying)return this.options.showHideAnimationType="none",void this.close();this.dispatch("destroy"),this.listeners=null,this.scrollWrap.ontouchmove=null,this.scrollWrap.ontouchend=null,this.element.remove(),this.mainScroll.itemHolders.forEach((t=>{t.slide&&t.slide.destroy()})),this.contentLoader.destroy(),this.events.removeAll()}refreshSlideContent(t){this.contentLoader.removeByIndex(t),this.mainScroll.itemHolders.forEach(((i,s)=>{let h=this.currSlide.index-1+s;this.canLoop()&&(h=this.getLoopedIndex(h)),h===t&&(this.setContent(i,t,!0),1===s&&(this.currSlide=i.slide,i.slide.setIsActive(!0)))})),this.dispatch("change")}setContent(t,i,s){if(this.canLoop()&&(i=this.getLoopedIndex(i)),t.slide){if(t.slide.index===i&&!s)return;t.slide.destroy(),t.slide=null}if(!this.canLoop()&&(i<0||i>=this.getNumItems()))return;const h=this.getItemData(i);t.slide=new S(h,i,this),i===this.currIndex&&(this.currSlide=t.slide),t.slide.append(t.el)}getViewportCenterPoint(){return{x:this.viewportSize.x/2,y:this.viewportSize.y/2}}updateSize(t){if(this.isDestroying)return;const s=g(this.options,this);!t&&e(s,this.si)||(i(this.si,s),this.dispatch("beforeResize"),i(this.viewportSize,this.si),this.oi(),this.dispatch("viewportSize"),this.mainScroll.resize(this.opener.isOpen),!this.hasMouse&&window.matchMedia("(any-hover: hover)").matches&&this.mouseDetected(),this.dispatch("resize"))}applyBgOpacity(t){this.bgOpacity=Math.max(t,0),this.bg.style.opacity=String(this.bgOpacity*this.options.bgOpacity)}mouseDetected(){this.hasMouse||(this.hasMouse=!0,this.element.classList.add("pswp--has_mouse"))}ni(){this.updateSize(),/iPhone|iPad|iPod/i.test(window.navigator.userAgent)&&setTimeout((()=>{this.updateSize()}),500)}oi(){this.setScrollOffset(0,window.pageYOffset)}setScrollOffset(t,i){this.offset.x=t,this.offset.y=i,this.dispatch("updateScrollOffset")}hi(){this.element=t("pswp"),this.element.setAttribute("tabindex","-1"),this.element.setAttribute("role","dialog"),this.template=this.element,this.bg=t("pswp__bg",!1,this.element),this.scrollWrap=t("pswp__scroll-wrap","section",this.element),this.container=t("pswp__container",!1,this.scrollWrap),this.scrollWrap.setAttribute("aria-roledescription","carousel"),this.container.setAttribute("aria-live","off"),this.container.setAttribute("id","pswp__items"),this.mainScroll.appendHolders(),this.ui=new H(this),this.ui.init(),(this.options.appendToEl||document.body).appendChild(this.element)}getThumbBounds(){return function(t,i,s){const h=s.dispatch("thumbBounds",{index:t,itemData:i,instance:s});if(h.thumbBounds)return h.thumbBounds;const{element:e}=i;let n,o;if(e&&!1!==s.options.thumbSelector){const t=s.options.thumbSelector||"img";o=e.matches(t)?e:e.querySelector(t)}return o=s.applyFilters("thumbEl",o,i,t),o&&(n=i.thumbCropped?function(t,i,s){const h=t.getBoundingClientRect(),e=h.width/i,n=h.height/s,o=e>n?e:n,r=(h.width-i*o)/2,a=(h.height-s*o)/2,c={x:h.left+r,y:h.top+a,w:i*o};return c.innerRect={w:h.width,h:h.height,x:r,y:a},c}(o,i.width||i.w,i.height||i.h):function(t){const i=t.getBoundingClientRect();return{x:i.left,y:i.top,w:i.width}}(o)),s.applyFilters("thumbBounds",n,i,t)}(this.currIndex,this.currSlide?this.currSlide.data:this.ei,this)}canLoop(){return this.options.loop&&this.getNumItems()>2}ii(t){window.matchMedia("(prefers-reduced-motion), (update: slow)").matches&&(t.showHideAnimationType="none",t.zoomAnimationDuration=0),this.options={...Q,...t}}}}));

/**
 * Swiper 11.1.4
 * Most modern mobile touch slider and framework with hardware accelerated transitions
 * https://swiperjs.com
 *
 * Copyright 2014-2024 Vladimir Kharlampidi
 *
 * Released under the MIT License
 *
 * Released on: May 30, 2024
 */

var Swiper = (function () {
  "use strict";
  function e(e) {
    return null !== e && "object" == typeof e && "constructor" in e && e.constructor === Object;
  }
  function t(s, a) {
    void 0 === s && (s = {}),
      void 0 === a && (a = {}),
      Object.keys(a).forEach((i) => {
        void 0 === s[i] ? (s[i] = a[i]) : e(a[i]) && e(s[i]) && Object.keys(a[i]).length > 0 && t(s[i], a[i]);
      });
  }
  const s = { body: {}, addEventListener() {}, removeEventListener() {}, activeElement: { blur() {}, nodeName: "" }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createEvent: () => ({ initEvent() {} }), createElement: () => ({ children: [], childNodes: [], style: {}, setAttribute() {}, getElementsByTagName: () => [] }), createElementNS: () => ({}), importNode: () => null, location: { hash: "", host: "", hostname: "", href: "", origin: "", pathname: "", protocol: "", search: "" } };
  function a() {
    const e = "undefined" != typeof document ? document : {};
    return t(e, s), e;
  }
  const i = {
    document: s,
    navigator: { userAgent: "" },
    location: { hash: "", host: "", hostname: "", href: "", origin: "", pathname: "", protocol: "", search: "" },
    history: { replaceState() {}, pushState() {}, go() {}, back() {} },
    CustomEvent: function () {
      return this;
    },
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    Image() {},
    Date() {},
    screen: {},
    setTimeout() {},
    clearTimeout() {},
    matchMedia: () => ({}),
    requestAnimationFrame: (e) => ("undefined" == typeof setTimeout ? (e(), null) : setTimeout(e, 0)),
    cancelAnimationFrame(e) {
      "undefined" != typeof setTimeout && clearTimeout(e);
    },
  };
  function r() {
    const e = "undefined" != typeof window ? window : {};
    return t(e, i), e;
  }
  function n(e) {
    return (
      void 0 === e && (e = ""),
      e
        .trim()
        .split(" ")
        .filter((e) => !!e.trim())
    );
  }
  function l(e, t) {
    return void 0 === t && (t = 0), setTimeout(e, t);
  }
  function o() {
    return Date.now();
  }
  function d(e, t) {
    void 0 === t && (t = "x");
    const s = r();
    let a, i, n;
    const l = (function (e) {
      const t = r();
      let s;
      return t.getComputedStyle && (s = t.getComputedStyle(e, null)), !s && e.currentStyle && (s = e.currentStyle), s || (s = e.style), s;
    })(e);
    return (
      s.WebKitCSSMatrix
        ? ((i = l.transform || l.webkitTransform),
          i.split(",").length > 6 &&
            (i = i
              .split(", ")
              .map((e) => e.replace(",", "."))
              .join(", ")),
          (n = new s.WebKitCSSMatrix("none" === i ? "" : i)))
        : ((n = l.MozTransform || l.OTransform || l.MsTransform || l.msTransform || l.transform || l.getPropertyValue("transform").replace("translate(", "matrix(1, 0, 0, 1,")), (a = n.toString().split(","))),
      "x" === t && (i = s.WebKitCSSMatrix ? n.m41 : 16 === a.length ? parseFloat(a[12]) : parseFloat(a[4])),
      "y" === t && (i = s.WebKitCSSMatrix ? n.m42 : 16 === a.length ? parseFloat(a[13]) : parseFloat(a[5])),
      i || 0
    );
  }
  function c(e) {
    return "object" == typeof e && null !== e && e.constructor && "Object" === Object.prototype.toString.call(e).slice(8, -1);
  }
  function p() {
    const e = Object(arguments.length <= 0 ? void 0 : arguments[0]),
      t = ["__proto__", "constructor", "prototype"];
    for (let a = 1; a < arguments.length; a += 1) {
      const i = a < 0 || arguments.length <= a ? void 0 : arguments[a];
      if (null != i && ((s = i), !("undefined" != typeof window && void 0 !== window.HTMLElement ? s instanceof HTMLElement : s && (1 === s.nodeType || 11 === s.nodeType)))) {
        const s = Object.keys(Object(i)).filter((e) => t.indexOf(e) < 0);
        for (let t = 0, a = s.length; t < a; t += 1) {
          const a = s[t],
            r = Object.getOwnPropertyDescriptor(i, a);
          void 0 !== r && r.enumerable && (c(e[a]) && c(i[a]) ? (i[a].__swiper__ ? (e[a] = i[a]) : p(e[a], i[a])) : !c(e[a]) && c(i[a]) ? ((e[a] = {}), i[a].__swiper__ ? (e[a] = i[a]) : p(e[a], i[a])) : (e[a] = i[a]));
        }
      }
    }
    var s;
    return e;
  }
  function u(e, t, s) {
    e.style.setProperty(t, s);
  }
  function m(e) {
    let { swiper: t, targetPosition: s, side: a } = e;
    const i = r(),
      n = -t.translate;
    let l,
      o = null;
    const d = t.params.speed;
    (t.wrapperEl.style.scrollSnapType = "none"), i.cancelAnimationFrame(t.cssModeFrameID);
    const c = s > n ? "next" : "prev",
      p = (e, t) => ("next" === c && e >= t) || ("prev" === c && e <= t),
      u = () => {
        (l = new Date().getTime()), null === o && (o = l);
        const e = Math.max(Math.min((l - o) / d, 1), 0),
          r = 0.5 - Math.cos(e * Math.PI) / 2;
        let c = n + r * (s - n);
        if ((p(c, s) && (c = s), t.wrapperEl.scrollTo({ [a]: c }), p(c, s)))
          return (
            (t.wrapperEl.style.overflow = "hidden"),
            (t.wrapperEl.style.scrollSnapType = ""),
            setTimeout(() => {
              (t.wrapperEl.style.overflow = ""), t.wrapperEl.scrollTo({ [a]: c });
            }),
            void i.cancelAnimationFrame(t.cssModeFrameID)
          );
        t.cssModeFrameID = i.requestAnimationFrame(u);
      };
    u();
  }
  function h(e) {
    return e.querySelector(".swiper-slide-transform") || (e.shadowRoot && e.shadowRoot.querySelector(".swiper-slide-transform")) || e;
  }
  function f(e, t) {
    return void 0 === t && (t = ""), [...e.children].filter((e) => e.matches(t));
  }
  function g(e) {
    try {
      return void console.warn(e);
    } catch (e) {}
  }
  function v(e, t) {
    void 0 === t && (t = []);
    const s = document.createElement(e);
    return s.classList.add(...(Array.isArray(t) ? t : n(t))), s;
  }
  function w(e) {
    const t = r(),
      s = a(),
      i = e.getBoundingClientRect(),
      n = s.body,
      l = e.clientTop || n.clientTop || 0,
      o = e.clientLeft || n.clientLeft || 0,
      d = e === t ? t.scrollY : e.scrollTop,
      c = e === t ? t.scrollX : e.scrollLeft;
    return { top: i.top + d - l, left: i.left + c - o };
  }
  function b(e, t) {
    return r().getComputedStyle(e, null).getPropertyValue(t);
  }
  function y(e) {
    let t,
      s = e;
    if (s) {
      for (t = 0; null !== (s = s.previousSibling); ) 1 === s.nodeType && (t += 1);
      return t;
    }
  }
  function E(e, t) {
    const s = [];
    let a = e.parentElement;
    for (; a; ) t ? a.matches(t) && s.push(a) : s.push(a), (a = a.parentElement);
    return s;
  }
  function x(e, t) {
    t &&
      e.addEventListener("transitionend", function s(a) {
        a.target === e && (t.call(e, a), e.removeEventListener("transitionend", s));
      });
  }
  function S(e, t, s) {
    const a = r();
    return s ? e["width" === t ? "offsetWidth" : "offsetHeight"] + parseFloat(a.getComputedStyle(e, null).getPropertyValue("width" === t ? "margin-right" : "margin-top")) + parseFloat(a.getComputedStyle(e, null).getPropertyValue("width" === t ? "margin-left" : "margin-bottom")) : e.offsetWidth;
  }
  function T(e) {
    return (Array.isArray(e) ? e : [e]).filter((e) => !!e);
  }
  let M, C, P;
  function L() {
    return (
      M ||
        (M = (function () {
          const e = r(),
            t = a();
          return { smoothScroll: t.documentElement && t.documentElement.style && "scrollBehavior" in t.documentElement.style, touch: !!("ontouchstart" in e || (e.DocumentTouch && t instanceof e.DocumentTouch)) };
        })()),
      M
    );
  }
  function I(e) {
    return (
      void 0 === e && (e = {}),
      C ||
        (C = (function (e) {
          let { userAgent: t } = void 0 === e ? {} : e;
          const s = L(),
            a = r(),
            i = a.navigator.platform,
            n = t || a.navigator.userAgent,
            l = { ios: !1, android: !1 },
            o = a.screen.width,
            d = a.screen.height,
            c = n.match(/(Android);?[\s\/]+([\d.]+)?/);
          let p = n.match(/(iPad).*OS\s([\d_]+)/);
          const u = n.match(/(iPod)(.*OS\s([\d_]+))?/),
            m = !p && n.match(/(iPhone\sOS|iOS)\s([\d_]+)/),
            h = "Win32" === i;
          let f = "MacIntel" === i;
          return !p && f && s.touch && ["1024x1366", "1366x1024", "834x1194", "1194x834", "834x1112", "1112x834", "768x1024", "1024x768", "820x1180", "1180x820", "810x1080", "1080x810"].indexOf(`${o}x${d}`) >= 0 && ((p = n.match(/(Version)\/([\d.]+)/)), p || (p = [0, 1, "13_0_0"]), (f = !1)), c && !h && ((l.os = "android"), (l.android = !0)), (p || m || u) && ((l.os = "ios"), (l.ios = !0)), l;
        })(e)),
      C
    );
  }
  function A() {
    return (
      P ||
        (P = (function () {
          const e = r(),
            t = I();
          let s = !1;
          function a() {
            const t = e.navigator.userAgent.toLowerCase();
            return t.indexOf("safari") >= 0 && t.indexOf("chrome") < 0 && t.indexOf("android") < 0;
          }
          if (a()) {
            const t = String(e.navigator.userAgent);
            if (t.includes("Version/")) {
              const [e, a] = t
                .split("Version/")[1]
                .split(" ")[0]
                .split(".")
                .map((e) => Number(e));
              s = e < 16 || (16 === e && a < 2);
            }
          }
          const i = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(e.navigator.userAgent),
            n = a();
          return { isSafari: s || n, needPerspectiveFix: s, need3dFix: n || (i && t.ios), isWebView: i };
        })()),
      P
    );
  }
  var z = {
    on(e, t, s) {
      const a = this;
      if (!a.eventsListeners || a.destroyed) return a;
      if ("function" != typeof t) return a;
      const i = s ? "unshift" : "push";
      return (
        e.split(" ").forEach((e) => {
          a.eventsListeners[e] || (a.eventsListeners[e] = []), a.eventsListeners[e][i](t);
        }),
        a
      );
    },
    once(e, t, s) {
      const a = this;
      if (!a.eventsListeners || a.destroyed) return a;
      if ("function" != typeof t) return a;
      function i() {
        a.off(e, i), i.__emitterProxy && delete i.__emitterProxy;
        for (var s = arguments.length, r = new Array(s), n = 0; n < s; n++) r[n] = arguments[n];
        t.apply(a, r);
      }
      return (i.__emitterProxy = t), a.on(e, i, s);
    },
    onAny(e, t) {
      const s = this;
      if (!s.eventsListeners || s.destroyed) return s;
      if ("function" != typeof e) return s;
      const a = t ? "unshift" : "push";
      return s.eventsAnyListeners.indexOf(e) < 0 && s.eventsAnyListeners[a](e), s;
    },
    offAny(e) {
      const t = this;
      if (!t.eventsListeners || t.destroyed) return t;
      if (!t.eventsAnyListeners) return t;
      const s = t.eventsAnyListeners.indexOf(e);
      return s >= 0 && t.eventsAnyListeners.splice(s, 1), t;
    },
    off(e, t) {
      const s = this;
      return !s.eventsListeners || s.destroyed
        ? s
        : s.eventsListeners
        ? (e.split(" ").forEach((e) => {
            void 0 === t
              ? (s.eventsListeners[e] = [])
              : s.eventsListeners[e] &&
                s.eventsListeners[e].forEach((a, i) => {
                  (a === t || (a.__emitterProxy && a.__emitterProxy === t)) && s.eventsListeners[e].splice(i, 1);
                });
          }),
          s)
        : s;
    },
    emit() {
      const e = this;
      if (!e.eventsListeners || e.destroyed) return e;
      if (!e.eventsListeners) return e;
      let t, s, a;
      for (var i = arguments.length, r = new Array(i), n = 0; n < i; n++) r[n] = arguments[n];
      "string" == typeof r[0] || Array.isArray(r[0]) ? ((t = r[0]), (s = r.slice(1, r.length)), (a = e)) : ((t = r[0].events), (s = r[0].data), (a = r[0].context || e)), s.unshift(a);
      return (
        (Array.isArray(t) ? t : t.split(" ")).forEach((t) => {
          e.eventsAnyListeners &&
            e.eventsAnyListeners.length &&
            e.eventsAnyListeners.forEach((e) => {
              e.apply(a, [t, ...s]);
            }),
            e.eventsListeners &&
              e.eventsListeners[t] &&
              e.eventsListeners[t].forEach((e) => {
                e.apply(a, s);
              });
        }),
        e
      );
    },
  };
  const $ = (e, t, s) => {
    t && !e.classList.contains(s) ? e.classList.add(s) : !t && e.classList.contains(s) && e.classList.remove(s);
  };
  const k = (e, t, s) => {
    t && !e.classList.contains(s) ? e.classList.add(s) : !t && e.classList.contains(s) && e.classList.remove(s);
  };
  const O = (e, t) => {
      if (!e || e.destroyed || !e.params) return;
      const s = t.closest(e.isElement ? "swiper-slide" : `.${e.params.slideClass}`);
      if (s) {
        let t = s.querySelector(`.${e.params.lazyPreloaderClass}`);
        !t &&
          e.isElement &&
          (s.shadowRoot
            ? (t = s.shadowRoot.querySelector(`.${e.params.lazyPreloaderClass}`))
            : requestAnimationFrame(() => {
                s.shadowRoot && ((t = s.shadowRoot.querySelector(`.${e.params.lazyPreloaderClass}`)), t && t.remove());
              })),
          t && t.remove();
      }
    },
    D = (e, t) => {
      if (!e.slides[t]) return;
      const s = e.slides[t].querySelector('[loading="lazy"]');
      s && s.removeAttribute("loading");
    },
    G = (e) => {
      if (!e || e.destroyed || !e.params) return;
      let t = e.params.lazyPreloadPrevNext;
      const s = e.slides.length;
      if (!s || !t || t < 0) return;
      t = Math.min(t, s);
      const a = "auto" === e.params.slidesPerView ? e.slidesPerViewDynamic() : Math.ceil(e.params.slidesPerView),
        i = e.activeIndex;
      if (e.params.grid && e.params.grid.rows > 1) {
        const s = i,
          r = [s - t];
        return (
          r.push(...Array.from({ length: t }).map((e, t) => s + a + t)),
          void e.slides.forEach((t, s) => {
            r.includes(t.column) && D(e, s);
          })
        );
      }
      const r = i + a - 1;
      if (e.params.rewind || e.params.loop)
        for (let a = i - t; a <= r + t; a += 1) {
          const t = ((a % s) + s) % s;
          (t < i || t > r) && D(e, t);
        }
      else for (let a = Math.max(i - t, 0); a <= Math.min(r + t, s - 1); a += 1) a !== i && (a > r || a < i) && D(e, a);
    };
  var H = {
    updateSize: function () {
      const e = this;
      let t, s;
      const a = e.el;
      (t = void 0 !== e.params.width && null !== e.params.width ? e.params.width : a.clientWidth), (s = void 0 !== e.params.height && null !== e.params.height ? e.params.height : a.clientHeight), (0 === t && e.isHorizontal()) || (0 === s && e.isVertical()) || ((t = t - parseInt(b(a, "padding-left") || 0, 10) - parseInt(b(a, "padding-right") || 0, 10)), (s = s - parseInt(b(a, "padding-top") || 0, 10) - parseInt(b(a, "padding-bottom") || 0, 10)), Number.isNaN(t) && (t = 0), Number.isNaN(s) && (s = 0), Object.assign(e, { width: t, height: s, size: e.isHorizontal() ? t : s }));
    },
    updateSlides: function () {
      const e = this;
      function t(t, s) {
        return parseFloat(t.getPropertyValue(e.getDirectionLabel(s)) || 0);
      }
      const s = e.params,
        { wrapperEl: a, slidesEl: i, size: r, rtlTranslate: n, wrongRTL: l } = e,
        o = e.virtual && s.virtual.enabled,
        d = o ? e.virtual.slides.length : e.slides.length,
        c = f(i, `.${e.params.slideClass}, swiper-slide`),
        p = o ? e.virtual.slides.length : c.length;
      let m = [];
      const h = [],
        g = [];
      let v = s.slidesOffsetBefore;
      "function" == typeof v && (v = s.slidesOffsetBefore.call(e));
      let w = s.slidesOffsetAfter;
      "function" == typeof w && (w = s.slidesOffsetAfter.call(e));
      const y = e.snapGrid.length,
        E = e.slidesGrid.length;
      let x = s.spaceBetween,
        T = -v,
        M = 0,
        C = 0;
      if (void 0 === r) return;
      "string" == typeof x && x.indexOf("%") >= 0 ? (x = (parseFloat(x.replace("%", "")) / 100) * r) : "string" == typeof x && (x = parseFloat(x)),
        (e.virtualSize = -x),
        c.forEach((e) => {
          n ? (e.style.marginLeft = "") : (e.style.marginRight = ""), (e.style.marginBottom = ""), (e.style.marginTop = "");
        }),
        s.centeredSlides && s.cssMode && (u(a, "--swiper-centered-offset-before", ""), u(a, "--swiper-centered-offset-after", ""));
      const P = s.grid && s.grid.rows > 1 && e.grid;
      let L;
      P ? e.grid.initSlides(c) : e.grid && e.grid.unsetSlides();
      const I = "auto" === s.slidesPerView && s.breakpoints && Object.keys(s.breakpoints).filter((e) => void 0 !== s.breakpoints[e].slidesPerView).length > 0;
      for (let a = 0; a < p; a += 1) {
        let i;
        if (((L = 0), c[a] && (i = c[a]), P && e.grid.updateSlide(a, i, c), !c[a] || "none" !== b(i, "display"))) {
          if ("auto" === s.slidesPerView) {
            I && (c[a].style[e.getDirectionLabel("width")] = "");
            const r = getComputedStyle(i),
              n = i.style.transform,
              l = i.style.webkitTransform;
            if ((n && (i.style.transform = "none"), l && (i.style.webkitTransform = "none"), s.roundLengths)) L = e.isHorizontal() ? S(i, "width", !0) : S(i, "height", !0);
            else {
              const e = t(r, "width"),
                s = t(r, "padding-left"),
                a = t(r, "padding-right"),
                n = t(r, "margin-left"),
                l = t(r, "margin-right"),
                o = r.getPropertyValue("box-sizing");
              if (o && "border-box" === o) L = e + n + l;
              else {
                const { clientWidth: t, offsetWidth: r } = i;
                L = e + s + a + n + l + (r - t);
              }
            }
            n && (i.style.transform = n), l && (i.style.webkitTransform = l), s.roundLengths && (L = Math.floor(L));
          } else (L = (r - (s.slidesPerView - 1) * x) / s.slidesPerView), s.roundLengths && (L = Math.floor(L)), c[a] && (c[a].style[e.getDirectionLabel("width")] = `${L}px`);
          c[a] && (c[a].swiperSlideSize = L), g.push(L), s.centeredSlides ? ((T = T + L / 2 + M / 2 + x), 0 === M && 0 !== a && (T = T - r / 2 - x), 0 === a && (T = T - r / 2 - x), Math.abs(T) < 0.001 && (T = 0), s.roundLengths && (T = Math.floor(T)), C % s.slidesPerGroup == 0 && m.push(T), h.push(T)) : (s.roundLengths && (T = Math.floor(T)), (C - Math.min(e.params.slidesPerGroupSkip, C)) % e.params.slidesPerGroup == 0 && m.push(T), h.push(T), (T = T + L + x)), (e.virtualSize += L + x), (M = L), (C += 1);
        }
      }
      if (((e.virtualSize = Math.max(e.virtualSize, r) + w), n && l && ("slide" === s.effect || "coverflow" === s.effect) && (a.style.width = `${e.virtualSize + x}px`), s.setWrapperSize && (a.style[e.getDirectionLabel("width")] = `${e.virtualSize + x}px`), P && e.grid.updateWrapperSize(L, m), !s.centeredSlides)) {
        const t = [];
        for (let a = 0; a < m.length; a += 1) {
          let i = m[a];
          s.roundLengths && (i = Math.floor(i)), m[a] <= e.virtualSize - r && t.push(i);
        }
        (m = t), Math.floor(e.virtualSize - r) - Math.floor(m[m.length - 1]) > 1 && m.push(e.virtualSize - r);
      }
      if (o && s.loop) {
        const t = g[0] + x;
        if (s.slidesPerGroup > 1) {
          const a = Math.ceil((e.virtual.slidesBefore + e.virtual.slidesAfter) / s.slidesPerGroup),
            i = t * s.slidesPerGroup;
          for (let e = 0; e < a; e += 1) m.push(m[m.length - 1] + i);
        }
        for (let a = 0; a < e.virtual.slidesBefore + e.virtual.slidesAfter; a += 1) 1 === s.slidesPerGroup && m.push(m[m.length - 1] + t), h.push(h[h.length - 1] + t), (e.virtualSize += t);
      }
      if ((0 === m.length && (m = [0]), 0 !== x)) {
        const t = e.isHorizontal() && n ? "marginLeft" : e.getDirectionLabel("marginRight");
        c.filter((e, t) => !(s.cssMode && !s.loop) || t !== c.length - 1).forEach((e) => {
          e.style[t] = `${x}px`;
        });
      }
      if (s.centeredSlides && s.centeredSlidesBounds) {
        let e = 0;
        g.forEach((t) => {
          e += t + (x || 0);
        }),
          (e -= x);
        const t = e - r;
        m = m.map((e) => (e <= 0 ? -v : e > t ? t + w : e));
      }
      if (s.centerInsufficientSlides) {
        let e = 0;
        g.forEach((t) => {
          e += t + (x || 0);
        }),
          (e -= x);
        const t = (s.slidesOffsetBefore || 0) + (s.slidesOffsetAfter || 0);
        if (e + t < r) {
          const s = (r - e - t) / 2;
          m.forEach((e, t) => {
            m[t] = e - s;
          }),
            h.forEach((e, t) => {
              h[t] = e + s;
            });
        }
      }
      if ((Object.assign(e, { slides: c, snapGrid: m, slidesGrid: h, slidesSizesGrid: g }), s.centeredSlides && s.cssMode && !s.centeredSlidesBounds)) {
        u(a, "--swiper-centered-offset-before", -m[0] + "px"), u(a, "--swiper-centered-offset-after", e.size / 2 - g[g.length - 1] / 2 + "px");
        const t = -e.snapGrid[0],
          s = -e.slidesGrid[0];
        (e.snapGrid = e.snapGrid.map((e) => e + t)), (e.slidesGrid = e.slidesGrid.map((e) => e + s));
      }
      if ((p !== d && e.emit("slidesLengthChange"), m.length !== y && (e.params.watchOverflow && e.checkOverflow(), e.emit("snapGridLengthChange")), h.length !== E && e.emit("slidesGridLengthChange"), s.watchSlidesProgress && e.updateSlidesOffset(), e.emit("slidesUpdated"), !(o || s.cssMode || ("slide" !== s.effect && "fade" !== s.effect)))) {
        const t = `${s.containerModifierClass}backface-hidden`,
          a = e.el.classList.contains(t);
        p <= s.maxBackfaceHiddenSlides ? a || e.el.classList.add(t) : a && e.el.classList.remove(t);
      }
    },
    updateAutoHeight: function (e) {
      const t = this,
        s = [],
        a = t.virtual && t.params.virtual.enabled;
      let i,
        r = 0;
      "number" == typeof e ? t.setTransition(e) : !0 === e && t.setTransition(t.params.speed);
      const n = (e) => (a ? t.slides[t.getSlideIndexByData(e)] : t.slides[e]);
      if ("auto" !== t.params.slidesPerView && t.params.slidesPerView > 1)
        if (t.params.centeredSlides)
          (t.visibleSlides || []).forEach((e) => {
            s.push(e);
          });
        else
          for (i = 0; i < Math.ceil(t.params.slidesPerView); i += 1) {
            const e = t.activeIndex + i;
            if (e > t.slides.length && !a) break;
            s.push(n(e));
          }
      else s.push(n(t.activeIndex));
      for (i = 0; i < s.length; i += 1)
        if (void 0 !== s[i]) {
          const e = s[i].offsetHeight;
          r = e > r ? e : r;
        }
      (r || 0 === r) && (t.wrapperEl.style.height = `${r}px`);
    },
    updateSlidesOffset: function () {
      const e = this,
        t = e.slides,
        s = e.isElement ? (e.isHorizontal() ? e.wrapperEl.offsetLeft : e.wrapperEl.offsetTop) : 0;
      for (let a = 0; a < t.length; a += 1) t[a].swiperSlideOffset = (e.isHorizontal() ? t[a].offsetLeft : t[a].offsetTop) - s - e.cssOverflowAdjustment();
    },
    updateSlidesProgress: function (e) {
      void 0 === e && (e = (this && this.translate) || 0);
      const t = this,
        s = t.params,
        { slides: a, rtlTranslate: i, snapGrid: r } = t;
      if (0 === a.length) return;
      void 0 === a[0].swiperSlideOffset && t.updateSlidesOffset();
      let n = -e;
      i && (n = e), (t.visibleSlidesIndexes = []), (t.visibleSlides = []);
      let l = s.spaceBetween;
      "string" == typeof l && l.indexOf("%") >= 0 ? (l = (parseFloat(l.replace("%", "")) / 100) * t.size) : "string" == typeof l && (l = parseFloat(l));
      for (let e = 0; e < a.length; e += 1) {
        const o = a[e];
        let d = o.swiperSlideOffset;
        s.cssMode && s.centeredSlides && (d -= a[0].swiperSlideOffset);
        const c = (n + (s.centeredSlides ? t.minTranslate() : 0) - d) / (o.swiperSlideSize + l),
          p = (n - r[0] + (s.centeredSlides ? t.minTranslate() : 0) - d) / (o.swiperSlideSize + l),
          u = -(n - d),
          m = u + t.slidesSizesGrid[e],
          h = u >= 0 && u <= t.size - t.slidesSizesGrid[e],
          f = (u >= 0 && u < t.size - 1) || (m > 1 && m <= t.size) || (u <= 0 && m >= t.size);
        f && (t.visibleSlides.push(o), t.visibleSlidesIndexes.push(e)), $(o, f, s.slideVisibleClass), $(o, h, s.slideFullyVisibleClass), (o.progress = i ? -c : c), (o.originalProgress = i ? -p : p);
      }
    },
    updateProgress: function (e) {
      const t = this;
      if (void 0 === e) {
        const s = t.rtlTranslate ? -1 : 1;
        e = (t && t.translate && t.translate * s) || 0;
      }
      const s = t.params,
        a = t.maxTranslate() - t.minTranslate();
      let { progress: i, isBeginning: r, isEnd: n, progressLoop: l } = t;
      const o = r,
        d = n;
      if (0 === a) (i = 0), (r = !0), (n = !0);
      else {
        i = (e - t.minTranslate()) / a;
        const s = Math.abs(e - t.minTranslate()) < 1,
          l = Math.abs(e - t.maxTranslate()) < 1;
        (r = s || i <= 0), (n = l || i >= 1), s && (i = 0), l && (i = 1);
      }
      if (s.loop) {
        const s = t.getSlideIndexByData(0),
          a = t.getSlideIndexByData(t.slides.length - 1),
          i = t.slidesGrid[s],
          r = t.slidesGrid[a],
          n = t.slidesGrid[t.slidesGrid.length - 1],
          o = Math.abs(e);
        (l = o >= i ? (o - i) / n : (o + n - r) / n), l > 1 && (l -= 1);
      }
      Object.assign(t, { progress: i, progressLoop: l, isBeginning: r, isEnd: n }), (s.watchSlidesProgress || (s.centeredSlides && s.autoHeight)) && t.updateSlidesProgress(e), r && !o && t.emit("reachBeginning toEdge"), n && !d && t.emit("reachEnd toEdge"), ((o && !r) || (d && !n)) && t.emit("fromEdge"), t.emit("progress", i);
    },
    updateSlidesClasses: function () {
      const e = this,
        { slides: t, params: s, slidesEl: a, activeIndex: i } = e,
        r = e.virtual && s.virtual.enabled,
        n = e.grid && s.grid && s.grid.rows > 1,
        l = (e) => f(a, `.${s.slideClass}${e}, swiper-slide${e}`)[0];
      let o, d, c;
      if (r)
        if (s.loop) {
          let t = i - e.virtual.slidesBefore;
          t < 0 && (t = e.virtual.slides.length + t), t >= e.virtual.slides.length && (t -= e.virtual.slides.length), (o = l(`[data-swiper-slide-index="${t}"]`));
        } else o = l(`[data-swiper-slide-index="${i}"]`);
      else n ? ((o = t.filter((e) => e.column === i)[0]), (c = t.filter((e) => e.column === i + 1)[0]), (d = t.filter((e) => e.column === i - 1)[0])) : (o = t[i]);
      o &&
        (n ||
          ((c = (function (e, t) {
            const s = [];
            for (; e.nextElementSibling; ) {
              const a = e.nextElementSibling;
              t ? a.matches(t) && s.push(a) : s.push(a), (e = a);
            }
            return s;
          })(o, `.${s.slideClass}, swiper-slide`)[0]),
          s.loop && !c && (c = t[0]),
          (d = (function (e, t) {
            const s = [];
            for (; e.previousElementSibling; ) {
              const a = e.previousElementSibling;
              t ? a.matches(t) && s.push(a) : s.push(a), (e = a);
            }
            return s;
          })(o, `.${s.slideClass}, swiper-slide`)[0]),
          s.loop && 0 === !d && (d = t[t.length - 1]))),
        t.forEach((e) => {
          k(e, e === o, s.slideActiveClass), k(e, e === c, s.slideNextClass), k(e, e === d, s.slidePrevClass);
        }),
        e.emitSlidesClasses();
    },
    updateActiveIndex: function (e) {
      const t = this,
        s = t.rtlTranslate ? t.translate : -t.translate,
        { snapGrid: a, params: i, activeIndex: r, realIndex: n, snapIndex: l } = t;
      let o,
        d = e;
      const c = (e) => {
        let s = e - t.virtual.slidesBefore;
        return s < 0 && (s = t.virtual.slides.length + s), s >= t.virtual.slides.length && (s -= t.virtual.slides.length), s;
      };
      if (
        (void 0 === d &&
          (d = (function (e) {
            const { slidesGrid: t, params: s } = e,
              a = e.rtlTranslate ? e.translate : -e.translate;
            let i;
            for (let e = 0; e < t.length; e += 1) void 0 !== t[e + 1] ? (a >= t[e] && a < t[e + 1] - (t[e + 1] - t[e]) / 2 ? (i = e) : a >= t[e] && a < t[e + 1] && (i = e + 1)) : a >= t[e] && (i = e);
            return s.normalizeSlideIndex && (i < 0 || void 0 === i) && (i = 0), i;
          })(t)),
        a.indexOf(s) >= 0)
      )
        o = a.indexOf(s);
      else {
        const e = Math.min(i.slidesPerGroupSkip, d);
        o = e + Math.floor((d - e) / i.slidesPerGroup);
      }
      if ((o >= a.length && (o = a.length - 1), d === r && !t.params.loop)) return void (o !== l && ((t.snapIndex = o), t.emit("snapIndexChange")));
      if (d === r && t.params.loop && t.virtual && t.params.virtual.enabled) return void (t.realIndex = c(d));
      const p = t.grid && i.grid && i.grid.rows > 1;
      let u;
      if (t.virtual && i.virtual.enabled && i.loop) u = c(d);
      else if (p) {
        const e = t.slides.filter((e) => e.column === d)[0];
        let s = parseInt(e.getAttribute("data-swiper-slide-index"), 10);
        Number.isNaN(s) && (s = Math.max(t.slides.indexOf(e), 0)), (u = Math.floor(s / i.grid.rows));
      } else if (t.slides[d]) {
        const e = t.slides[d].getAttribute("data-swiper-slide-index");
        u = e ? parseInt(e, 10) : d;
      } else u = d;
      Object.assign(t, { previousSnapIndex: l, snapIndex: o, previousRealIndex: n, realIndex: u, previousIndex: r, activeIndex: d }), t.initialized && G(t), t.emit("activeIndexChange"), t.emit("snapIndexChange"), (t.initialized || t.params.runCallbacksOnInit) && (n !== u && t.emit("realIndexChange"), t.emit("slideChange"));
    },
    updateClickedSlide: function (e, t) {
      const s = this,
        a = s.params;
      let i = e.closest(`.${a.slideClass}, swiper-slide`);
      !i &&
        s.isElement &&
        t &&
        t.length > 1 &&
        t.includes(e) &&
        [...t.slice(t.indexOf(e) + 1, t.length)].forEach((e) => {
          !i && e.matches && e.matches(`.${a.slideClass}, swiper-slide`) && (i = e);
        });
      let r,
        n = !1;
      if (i)
        for (let e = 0; e < s.slides.length; e += 1)
          if (s.slides[e] === i) {
            (n = !0), (r = e);
            break;
          }
      if (!i || !n) return (s.clickedSlide = void 0), void (s.clickedIndex = void 0);
      (s.clickedSlide = i), s.virtual && s.params.virtual.enabled ? (s.clickedIndex = parseInt(i.getAttribute("data-swiper-slide-index"), 10)) : (s.clickedIndex = r), a.slideToClickedSlide && void 0 !== s.clickedIndex && s.clickedIndex !== s.activeIndex && s.slideToClickedSlide();
    },
  };
  var N = {
    getTranslate: function (e) {
      void 0 === e && (e = this.isHorizontal() ? "x" : "y");
      const { params: t, rtlTranslate: s, translate: a, wrapperEl: i } = this;
      if (t.virtualTranslate) return s ? -a : a;
      if (t.cssMode) return a;
      let r = d(i, e);
      return (r += this.cssOverflowAdjustment()), s && (r = -r), r || 0;
    },
    setTranslate: function (e, t) {
      const s = this,
        { rtlTranslate: a, params: i, wrapperEl: r, progress: n } = s;
      let l,
        o = 0,
        d = 0;
      s.isHorizontal() ? (o = a ? -e : e) : (d = e), i.roundLengths && ((o = Math.floor(o)), (d = Math.floor(d))), (s.previousTranslate = s.translate), (s.translate = s.isHorizontal() ? o : d), i.cssMode ? (r[s.isHorizontal() ? "scrollLeft" : "scrollTop"] = s.isHorizontal() ? -o : -d) : i.virtualTranslate || (s.isHorizontal() ? (o -= s.cssOverflowAdjustment()) : (d -= s.cssOverflowAdjustment()), (r.style.transform = `translate3d(${o}px, ${d}px, 0px)`));
      const c = s.maxTranslate() - s.minTranslate();
      (l = 0 === c ? 0 : (e - s.minTranslate()) / c), l !== n && s.updateProgress(e), s.emit("setTranslate", s.translate, t);
    },
    minTranslate: function () {
      return -this.snapGrid[0];
    },
    maxTranslate: function () {
      return -this.snapGrid[this.snapGrid.length - 1];
    },
    translateTo: function (e, t, s, a, i) {
      void 0 === e && (e = 0), void 0 === t && (t = this.params.speed), void 0 === s && (s = !0), void 0 === a && (a = !0);
      const r = this,
        { params: n, wrapperEl: l } = r;
      if (r.animating && n.preventInteractionOnTransition) return !1;
      const o = r.minTranslate(),
        d = r.maxTranslate();
      let c;
      if (((c = a && e > o ? o : a && e < d ? d : e), r.updateProgress(c), n.cssMode)) {
        const e = r.isHorizontal();
        if (0 === t) l[e ? "scrollLeft" : "scrollTop"] = -c;
        else {
          if (!r.support.smoothScroll) return m({ swiper: r, targetPosition: -c, side: e ? "left" : "top" }), !0;
          l.scrollTo({ [e ? "left" : "top"]: -c, behavior: "smooth" });
        }
        return !0;
      }
      return (
        0 === t
          ? (r.setTransition(0), r.setTranslate(c), s && (r.emit("beforeTransitionStart", t, i), r.emit("transitionEnd")))
          : (r.setTransition(t),
            r.setTranslate(c),
            s && (r.emit("beforeTransitionStart", t, i), r.emit("transitionStart")),
            r.animating ||
              ((r.animating = !0),
              r.onTranslateToWrapperTransitionEnd ||
                (r.onTranslateToWrapperTransitionEnd = function (e) {
                  r && !r.destroyed && e.target === this && (r.wrapperEl.removeEventListener("transitionend", r.onTranslateToWrapperTransitionEnd), (r.onTranslateToWrapperTransitionEnd = null), delete r.onTranslateToWrapperTransitionEnd, (r.animating = !1), s && r.emit("transitionEnd"));
                }),
              r.wrapperEl.addEventListener("transitionend", r.onTranslateToWrapperTransitionEnd))),
        !0
      );
    },
  };
  function X(e) {
    let { swiper: t, runCallbacks: s, direction: a, step: i } = e;
    const { activeIndex: r, previousIndex: n } = t;
    let l = a;
    if ((l || (l = r > n ? "next" : r < n ? "prev" : "reset"), t.emit(`transition${i}`), s && r !== n)) {
      if ("reset" === l) return void t.emit(`slideResetTransition${i}`);
      t.emit(`slideChangeTransition${i}`), "next" === l ? t.emit(`slideNextTransition${i}`) : t.emit(`slidePrevTransition${i}`);
    }
  }
  var B = {
    slideTo: function (e, t, s, a, i) {
      void 0 === e && (e = 0), void 0 === s && (s = !0), "string" == typeof e && (e = parseInt(e, 10));
      const r = this;
      let n = e;
      n < 0 && (n = 0);
      const { params: l, snapGrid: o, slidesGrid: d, previousIndex: c, activeIndex: p, rtlTranslate: u, wrapperEl: h, enabled: f } = r;
      if ((!f && !a && !i) || r.destroyed || (r.animating && l.preventInteractionOnTransition)) return !1;
      void 0 === t && (t = r.params.speed);
      const g = Math.min(r.params.slidesPerGroupSkip, n);
      let v = g + Math.floor((n - g) / r.params.slidesPerGroup);
      v >= o.length && (v = o.length - 1);
      const w = -o[v];
      if (l.normalizeSlideIndex)
        for (let e = 0; e < d.length; e += 1) {
          const t = -Math.floor(100 * w),
            s = Math.floor(100 * d[e]),
            a = Math.floor(100 * d[e + 1]);
          void 0 !== d[e + 1] ? (t >= s && t < a - (a - s) / 2 ? (n = e) : t >= s && t < a && (n = e + 1)) : t >= s && (n = e);
        }
      if (r.initialized && n !== p) {
        if (!r.allowSlideNext && (u ? w > r.translate && w > r.minTranslate() : w < r.translate && w < r.minTranslate())) return !1;
        if (!r.allowSlidePrev && w > r.translate && w > r.maxTranslate() && (p || 0) !== n) return !1;
      }
      let b;
      if ((n !== (c || 0) && s && r.emit("beforeSlideChangeStart"), r.updateProgress(w), (b = n > p ? "next" : n < p ? "prev" : "reset"), (u && -w === r.translate) || (!u && w === r.translate))) return r.updateActiveIndex(n), l.autoHeight && r.updateAutoHeight(), r.updateSlidesClasses(), "slide" !== l.effect && r.setTranslate(w), "reset" !== b && (r.transitionStart(s, b), r.transitionEnd(s, b)), !1;
      if (l.cssMode) {
        const e = r.isHorizontal(),
          s = u ? w : -w;
        if (0 === t) {
          const t = r.virtual && r.params.virtual.enabled;
          t && ((r.wrapperEl.style.scrollSnapType = "none"), (r._immediateVirtual = !0)),
            t && !r._cssModeVirtualInitialSet && r.params.initialSlide > 0
              ? ((r._cssModeVirtualInitialSet = !0),
                requestAnimationFrame(() => {
                  h[e ? "scrollLeft" : "scrollTop"] = s;
                }))
              : (h[e ? "scrollLeft" : "scrollTop"] = s),
            t &&
              requestAnimationFrame(() => {
                (r.wrapperEl.style.scrollSnapType = ""), (r._immediateVirtual = !1);
              });
        } else {
          if (!r.support.smoothScroll) return m({ swiper: r, targetPosition: s, side: e ? "left" : "top" }), !0;
          h.scrollTo({ [e ? "left" : "top"]: s, behavior: "smooth" });
        }
        return !0;
      }
      return (
        r.setTransition(t),
        r.setTranslate(w),
        r.updateActiveIndex(n),
        r.updateSlidesClasses(),
        r.emit("beforeTransitionStart", t, a),
        r.transitionStart(s, b),
        0 === t
          ? r.transitionEnd(s, b)
          : r.animating ||
            ((r.animating = !0),
            r.onSlideToWrapperTransitionEnd ||
              (r.onSlideToWrapperTransitionEnd = function (e) {
                r && !r.destroyed && e.target === this && (r.wrapperEl.removeEventListener("transitionend", r.onSlideToWrapperTransitionEnd), (r.onSlideToWrapperTransitionEnd = null), delete r.onSlideToWrapperTransitionEnd, r.transitionEnd(s, b));
              }),
            r.wrapperEl.addEventListener("transitionend", r.onSlideToWrapperTransitionEnd)),
        !0
      );
    },
    slideToLoop: function (e, t, s, a) {
      if ((void 0 === e && (e = 0), void 0 === s && (s = !0), "string" == typeof e)) {
        e = parseInt(e, 10);
      }
      const i = this;
      if (i.destroyed) return;
      void 0 === t && (t = i.params.speed);
      const r = i.grid && i.params.grid && i.params.grid.rows > 1;
      let n = e;
      if (i.params.loop)
        if (i.virtual && i.params.virtual.enabled) n += i.virtual.slidesBefore;
        else {
          let e;
          if (r) {
            const t = n * i.params.grid.rows;
            e = i.slides.filter((e) => 1 * e.getAttribute("data-swiper-slide-index") === t)[0].column;
          } else e = i.getSlideIndexByData(n);
          const t = r ? Math.ceil(i.slides.length / i.params.grid.rows) : i.slides.length,
            { centeredSlides: s } = i.params;
          let l = i.params.slidesPerView;
          "auto" === l ? (l = i.slidesPerViewDynamic()) : ((l = Math.ceil(parseFloat(i.params.slidesPerView, 10))), s && l % 2 == 0 && (l += 1));
          let o = t - e < l;
          if ((s && (o = o || e < Math.ceil(l / 2)), a && s && "auto" !== i.params.slidesPerView && !r && (o = !1), o)) {
            const a = s ? (e < i.activeIndex ? "prev" : "next") : e - i.activeIndex - 1 < i.params.slidesPerView ? "next" : "prev";
            i.loopFix({ direction: a, slideTo: !0, activeSlideIndex: "next" === a ? e + 1 : e - t + 1, slideRealIndex: "next" === a ? i.realIndex : void 0 });
          }
          if (r) {
            const e = n * i.params.grid.rows;
            n = i.slides.filter((t) => 1 * t.getAttribute("data-swiper-slide-index") === e)[0].column;
          } else n = i.getSlideIndexByData(n);
        }
      return (
        requestAnimationFrame(() => {
          i.slideTo(n, t, s, a);
        }),
        i
      );
    },
    slideNext: function (e, t, s) {
      void 0 === t && (t = !0);
      const a = this,
        { enabled: i, params: r, animating: n } = a;
      if (!i || a.destroyed) return a;
      void 0 === e && (e = a.params.speed);
      let l = r.slidesPerGroup;
      "auto" === r.slidesPerView && 1 === r.slidesPerGroup && r.slidesPerGroupAuto && (l = Math.max(a.slidesPerViewDynamic("current", !0), 1));
      const o = a.activeIndex < r.slidesPerGroupSkip ? 1 : l,
        d = a.virtual && r.virtual.enabled;
      if (r.loop) {
        if (n && !d && r.loopPreventsSliding) return !1;
        if ((a.loopFix({ direction: "next" }), (a._clientLeft = a.wrapperEl.clientLeft), a.activeIndex === a.slides.length - 1 && r.cssMode))
          return (
            requestAnimationFrame(() => {
              a.slideTo(a.activeIndex + o, e, t, s);
            }),
            !0
          );
      }
      return r.rewind && a.isEnd ? a.slideTo(0, e, t, s) : a.slideTo(a.activeIndex + o, e, t, s);
    },
    slidePrev: function (e, t, s) {
      void 0 === t && (t = !0);
      const a = this,
        { params: i, snapGrid: r, slidesGrid: n, rtlTranslate: l, enabled: o, animating: d } = a;
      if (!o || a.destroyed) return a;
      void 0 === e && (e = a.params.speed);
      const c = a.virtual && i.virtual.enabled;
      if (i.loop) {
        if (d && !c && i.loopPreventsSliding) return !1;
        a.loopFix({ direction: "prev" }), (a._clientLeft = a.wrapperEl.clientLeft);
      }
      function p(e) {
        return e < 0 ? -Math.floor(Math.abs(e)) : Math.floor(e);
      }
      const u = p(l ? a.translate : -a.translate),
        m = r.map((e) => p(e));
      let h = r[m.indexOf(u) - 1];
      if (void 0 === h && i.cssMode) {
        let e;
        r.forEach((t, s) => {
          u >= t && (e = s);
        }),
          void 0 !== e && (h = r[e > 0 ? e - 1 : e]);
      }
      let f = 0;
      if ((void 0 !== h && ((f = n.indexOf(h)), f < 0 && (f = a.activeIndex - 1), "auto" === i.slidesPerView && 1 === i.slidesPerGroup && i.slidesPerGroupAuto && ((f = f - a.slidesPerViewDynamic("previous", !0) + 1), (f = Math.max(f, 0)))), i.rewind && a.isBeginning)) {
        const i = a.params.virtual && a.params.virtual.enabled && a.virtual ? a.virtual.slides.length - 1 : a.slides.length - 1;
        return a.slideTo(i, e, t, s);
      }
      return i.loop && 0 === a.activeIndex && i.cssMode
        ? (requestAnimationFrame(() => {
            a.slideTo(f, e, t, s);
          }),
          !0)
        : a.slideTo(f, e, t, s);
    },
    slideReset: function (e, t, s) {
      void 0 === t && (t = !0);
      const a = this;
      if (!a.destroyed) return void 0 === e && (e = a.params.speed), a.slideTo(a.activeIndex, e, t, s);
    },
    slideToClosest: function (e, t, s, a) {
      void 0 === t && (t = !0), void 0 === a && (a = 0.5);
      const i = this;
      if (i.destroyed) return;
      void 0 === e && (e = i.params.speed);
      let r = i.activeIndex;
      const n = Math.min(i.params.slidesPerGroupSkip, r),
        l = n + Math.floor((r - n) / i.params.slidesPerGroup),
        o = i.rtlTranslate ? i.translate : -i.translate;
      if (o >= i.snapGrid[l]) {
        const e = i.snapGrid[l];
        o - e > (i.snapGrid[l + 1] - e) * a && (r += i.params.slidesPerGroup);
      } else {
        const e = i.snapGrid[l - 1];
        o - e <= (i.snapGrid[l] - e) * a && (r -= i.params.slidesPerGroup);
      }
      return (r = Math.max(r, 0)), (r = Math.min(r, i.slidesGrid.length - 1)), i.slideTo(r, e, t, s);
    },
    slideToClickedSlide: function () {
      const e = this;
      if (e.destroyed) return;
      const { params: t, slidesEl: s } = e,
        a = "auto" === t.slidesPerView ? e.slidesPerViewDynamic() : t.slidesPerView;
      let i,
        r = e.clickedIndex;
      const n = e.isElement ? "swiper-slide" : `.${t.slideClass}`;
      if (t.loop) {
        if (e.animating) return;
        (i = parseInt(e.clickedSlide.getAttribute("data-swiper-slide-index"), 10)),
          t.centeredSlides
            ? r < e.loopedSlides - a / 2 || r > e.slides.length - e.loopedSlides + a / 2
              ? (e.loopFix(),
                (r = e.getSlideIndex(f(s, `${n}[data-swiper-slide-index="${i}"]`)[0])),
                l(() => {
                  e.slideTo(r);
                }))
              : e.slideTo(r)
            : r > e.slides.length - a
            ? (e.loopFix(),
              (r = e.getSlideIndex(f(s, `${n}[data-swiper-slide-index="${i}"]`)[0])),
              l(() => {
                e.slideTo(r);
              }))
            : e.slideTo(r);
      } else e.slideTo(r);
    },
  };
  var Y = {
    loopCreate: function (e) {
      const t = this,
        { params: s, slidesEl: a } = t;
      if (!s.loop || (t.virtual && t.params.virtual.enabled)) return;
      const i = () => {
          f(a, `.${s.slideClass}, swiper-slide`).forEach((e, t) => {
            e.setAttribute("data-swiper-slide-index", t);
          });
        },
        r = t.grid && s.grid && s.grid.rows > 1,
        n = s.slidesPerGroup * (r ? s.grid.rows : 1),
        l = t.slides.length % n != 0,
        o = r && t.slides.length % s.grid.rows != 0,
        d = (e) => {
          for (let a = 0; a < e; a += 1) {
            const e = t.isElement ? v("swiper-slide", [s.slideBlankClass]) : v("div", [s.slideClass, s.slideBlankClass]);
            t.slidesEl.append(e);
          }
        };
      if (l) {
        if (s.loopAddBlankSlides) {
          d(n - (t.slides.length % n)), t.recalcSlides(), t.updateSlides();
        } else g("Swiper Loop Warning: The number of slides is not even to slidesPerGroup, loop mode may not function properly. You need to add more slides (or make duplicates, or empty slides)");
        i();
      } else if (o) {
        if (s.loopAddBlankSlides) {
          d(s.grid.rows - (t.slides.length % s.grid.rows)), t.recalcSlides(), t.updateSlides();
        } else g("Swiper Loop Warning: The number of slides is not even to grid.rows, loop mode may not function properly. You need to add more slides (or make duplicates, or empty slides)");
        i();
      } else i();
      t.loopFix({ slideRealIndex: e, direction: s.centeredSlides ? void 0 : "next" });
    },
    loopFix: function (e) {
      let { slideRealIndex: t, slideTo: s = !0, direction: a, setTranslate: i, activeSlideIndex: r, byController: n, byMousewheel: l } = void 0 === e ? {} : e;
      const o = this;
      if (!o.params.loop) return;
      o.emit("beforeLoopFix");
      const { slides: d, allowSlidePrev: c, allowSlideNext: p, slidesEl: u, params: m } = o,
        { centeredSlides: h } = m;
      if (((o.allowSlidePrev = !0), (o.allowSlideNext = !0), o.virtual && m.virtual.enabled)) return s && (m.centeredSlides || 0 !== o.snapIndex ? (m.centeredSlides && o.snapIndex < m.slidesPerView ? o.slideTo(o.virtual.slides.length + o.snapIndex, 0, !1, !0) : o.snapIndex === o.snapGrid.length - 1 && o.slideTo(o.virtual.slidesBefore, 0, !1, !0)) : o.slideTo(o.virtual.slides.length, 0, !1, !0)), (o.allowSlidePrev = c), (o.allowSlideNext = p), void o.emit("loopFix");
      let f = m.slidesPerView;
      "auto" === f ? (f = o.slidesPerViewDynamic()) : ((f = Math.ceil(parseFloat(m.slidesPerView, 10))), h && f % 2 == 0 && (f += 1));
      const v = m.slidesPerGroupAuto ? f : m.slidesPerGroup;
      let w = v;
      w % v != 0 && (w += v - (w % v)), (w += m.loopAdditionalSlides), (o.loopedSlides = w);
      const b = o.grid && m.grid && m.grid.rows > 1;
      d.length < f + w ? g("Swiper Loop Warning: The number of slides is not enough for loop mode, it will be disabled and not function properly. You need to add more slides (or make duplicates) or lower the values of slidesPerView and slidesPerGroup parameters") : b && "row" === m.grid.fill && g("Swiper Loop Warning: Loop mode is not compatible with grid.fill = `row`");
      const y = [],
        E = [];
      let x = o.activeIndex;
      void 0 === r ? (r = o.getSlideIndex(d.filter((e) => e.classList.contains(m.slideActiveClass))[0])) : (x = r);
      const S = "next" === a || !a,
        T = "prev" === a || !a;
      let M = 0,
        C = 0;
      const P = b ? Math.ceil(d.length / m.grid.rows) : d.length,
        L = (b ? d[r].column : r) + (h && void 0 === i ? -f / 2 + 0.5 : 0);
      if (L < w) {
        M = Math.max(w - L, v);
        for (let e = 0; e < w - L; e += 1) {
          const t = e - Math.floor(e / P) * P;
          if (b) {
            const e = P - t - 1;
            for (let t = d.length - 1; t >= 0; t -= 1) d[t].column === e && y.push(t);
          } else y.push(P - t - 1);
        }
      } else if (L + f > P - w) {
        C = Math.max(L - (P - 2 * w), v);
        for (let e = 0; e < C; e += 1) {
          const t = e - Math.floor(e / P) * P;
          b
            ? d.forEach((e, s) => {
                e.column === t && E.push(s);
              })
            : E.push(t);
        }
      }
      if (
        ((o.__preventObserver__ = !0),
        requestAnimationFrame(() => {
          o.__preventObserver__ = !1;
        }),
        T &&
          y.forEach((e) => {
            (d[e].swiperLoopMoveDOM = !0), u.prepend(d[e]), (d[e].swiperLoopMoveDOM = !1);
          }),
        S &&
          E.forEach((e) => {
            (d[e].swiperLoopMoveDOM = !0), u.append(d[e]), (d[e].swiperLoopMoveDOM = !1);
          }),
        o.recalcSlides(),
        "auto" === m.slidesPerView
          ? o.updateSlides()
          : b &&
            ((y.length > 0 && T) || (E.length > 0 && S)) &&
            o.slides.forEach((e, t) => {
              o.grid.updateSlide(t, e, o.slides);
            }),
        m.watchSlidesProgress && o.updateSlidesOffset(),
        s)
      )
        if (y.length > 0 && T) {
          if (void 0 === t) {
            const e = o.slidesGrid[x],
              t = o.slidesGrid[x + M] - e;
            l ? o.setTranslate(o.translate - t) : (o.slideTo(x + Math.ceil(M), 0, !1, !0), i && ((o.touchEventsData.startTranslate = o.touchEventsData.startTranslate - t), (o.touchEventsData.currentTranslate = o.touchEventsData.currentTranslate - t)));
          } else if (i) {
            const e = b ? y.length / m.grid.rows : y.length;
            o.slideTo(o.activeIndex + e, 0, !1, !0), (o.touchEventsData.currentTranslate = o.translate);
          }
        } else if (E.length > 0 && S)
          if (void 0 === t) {
            const e = o.slidesGrid[x],
              t = o.slidesGrid[x - C] - e;
            l ? o.setTranslate(o.translate - t) : (o.slideTo(x - C, 0, !1, !0), i && ((o.touchEventsData.startTranslate = o.touchEventsData.startTranslate - t), (o.touchEventsData.currentTranslate = o.touchEventsData.currentTranslate - t)));
          } else {
            const e = b ? E.length / m.grid.rows : E.length;
            o.slideTo(o.activeIndex - e, 0, !1, !0);
          }
      if (((o.allowSlidePrev = c), (o.allowSlideNext = p), o.controller && o.controller.control && !n)) {
        const e = { slideRealIndex: t, direction: a, setTranslate: i, activeSlideIndex: r, byController: !0 };
        Array.isArray(o.controller.control)
          ? o.controller.control.forEach((t) => {
              !t.destroyed && t.params.loop && t.loopFix({ ...e, slideTo: t.params.slidesPerView === m.slidesPerView && s });
            })
          : o.controller.control instanceof o.constructor && o.controller.control.params.loop && o.controller.control.loopFix({ ...e, slideTo: o.controller.control.params.slidesPerView === m.slidesPerView && s });
      }
      o.emit("loopFix");
    },
    loopDestroy: function () {
      const e = this,
        { params: t, slidesEl: s } = e;
      if (!t.loop || (e.virtual && e.params.virtual.enabled)) return;
      e.recalcSlides();
      const a = [];
      e.slides.forEach((e) => {
        const t = void 0 === e.swiperSlideIndex ? 1 * e.getAttribute("data-swiper-slide-index") : e.swiperSlideIndex;
        a[t] = e;
      }),
        e.slides.forEach((e) => {
          e.removeAttribute("data-swiper-slide-index");
        }),
        a.forEach((e) => {
          s.append(e);
        }),
        e.recalcSlides(),
        e.slideTo(e.realIndex, 0);
    },
  };
  function R(e, t, s) {
    const a = r(),
      { params: i } = e,
      n = i.edgeSwipeDetection,
      l = i.edgeSwipeThreshold;
    return !n || !(s <= l || s >= a.innerWidth - l) || ("prevent" === n && (t.preventDefault(), !0));
  }
  function F(e) {
    const t = this,
      s = a();
    let i = e;
    i.originalEvent && (i = i.originalEvent);
    const n = t.touchEventsData;
    if ("pointerdown" === i.type) {
      if (null !== n.pointerId && n.pointerId !== i.pointerId) return;
      n.pointerId = i.pointerId;
    } else "touchstart" === i.type && 1 === i.targetTouches.length && (n.touchId = i.targetTouches[0].identifier);
    if ("touchstart" === i.type) return void R(t, i, i.targetTouches[0].pageX);
    const { params: l, touches: d, enabled: c } = t;
    if (!c) return;
    if (!l.simulateTouch && "mouse" === i.pointerType) return;
    if (t.animating && l.preventInteractionOnTransition) return;
    !t.animating && l.cssMode && l.loop && t.loopFix();
    let p = i.target;
    if ("wrapper" === l.touchEventsTarget && !t.wrapperEl.contains(p)) return;
    if ("which" in i && 3 === i.which) return;
    if ("button" in i && i.button > 0) return;
    if (n.isTouched && n.isMoved) return;
    const u = !!l.noSwipingClass && "" !== l.noSwipingClass,
      m = i.composedPath ? i.composedPath() : i.path;
    u && i.target && i.target.shadowRoot && m && (p = m[0]);
    const h = l.noSwipingSelector ? l.noSwipingSelector : `.${l.noSwipingClass}`,
      f = !(!i.target || !i.target.shadowRoot);
    if (
      l.noSwiping &&
      (f
        ? (function (e, t) {
            return (
              void 0 === t && (t = this),
              (function t(s) {
                if (!s || s === a() || s === r()) return null;
                s.assignedSlot && (s = s.assignedSlot);
                const i = s.closest(e);
                return i || s.getRootNode ? i || t(s.getRootNode().host) : null;
              })(t)
            );
          })(h, p)
        : p.closest(h))
    )
      return void (t.allowClick = !0);
    if (l.swipeHandler && !p.closest(l.swipeHandler)) return;
    (d.currentX = i.pageX), (d.currentY = i.pageY);
    const g = d.currentX,
      v = d.currentY;
    if (!R(t, i, g)) return;
    Object.assign(n, { isTouched: !0, isMoved: !1, allowTouchCallbacks: !0, isScrolling: void 0, startMoving: void 0 }), (d.startX = g), (d.startY = v), (n.touchStartTime = o()), (t.allowClick = !0), t.updateSize(), (t.swipeDirection = void 0), l.threshold > 0 && (n.allowThresholdMove = !1);
    let w = !0;
    p.matches(n.focusableElements) && ((w = !1), "SELECT" === p.nodeName && (n.isTouched = !1)), s.activeElement && s.activeElement.matches(n.focusableElements) && s.activeElement !== p && s.activeElement.blur();
    const b = w && t.allowTouchMove && l.touchStartPreventDefault;
    (!l.touchStartForcePreventDefault && !b) || p.isContentEditable || i.preventDefault(), l.freeMode && l.freeMode.enabled && t.freeMode && t.animating && !l.cssMode && t.freeMode.onTouchStart(), t.emit("touchStart", i);
  }
  function q(e) {
    const t = a(),
      s = this,
      i = s.touchEventsData,
      { params: r, touches: n, rtlTranslate: l, enabled: d } = s;
    if (!d) return;
    if (!r.simulateTouch && "mouse" === e.pointerType) return;
    let c,
      p = e;
    if ((p.originalEvent && (p = p.originalEvent), "pointermove" === p.type)) {
      if (null !== i.touchId) return;
      if (p.pointerId !== i.pointerId) return;
    }
    if ("touchmove" === p.type) {
      if (((c = [...p.changedTouches].filter((e) => e.identifier === i.touchId)[0]), !c || c.identifier !== i.touchId)) return;
    } else c = p;
    if (!i.isTouched) return void (i.startMoving && i.isScrolling && s.emit("touchMoveOpposite", p));
    const u = c.pageX,
      m = c.pageY;
    if (p.preventedByNestedSwiper) return (n.startX = u), void (n.startY = m);
    if (!s.allowTouchMove) return p.target.matches(i.focusableElements) || (s.allowClick = !1), void (i.isTouched && (Object.assign(n, { startX: u, startY: m, currentX: u, currentY: m }), (i.touchStartTime = o())));
    if (r.touchReleaseOnEdges && !r.loop)
      if (s.isVertical()) {
        if ((m < n.startY && s.translate <= s.maxTranslate()) || (m > n.startY && s.translate >= s.minTranslate())) return (i.isTouched = !1), void (i.isMoved = !1);
      } else if ((u < n.startX && s.translate <= s.maxTranslate()) || (u > n.startX && s.translate >= s.minTranslate())) return;
    if (t.activeElement && p.target === t.activeElement && p.target.matches(i.focusableElements)) return (i.isMoved = !0), void (s.allowClick = !1);
    i.allowTouchCallbacks && s.emit("touchMove", p), (n.previousX = n.currentX), (n.previousY = n.currentY), (n.currentX = u), (n.currentY = m);
    const h = n.currentX - n.startX,
      f = n.currentY - n.startY;
    if (s.params.threshold && Math.sqrt(h ** 2 + f ** 2) < s.params.threshold) return;
    if (void 0 === i.isScrolling) {
      let e;
      (s.isHorizontal() && n.currentY === n.startY) || (s.isVertical() && n.currentX === n.startX) ? (i.isScrolling = !1) : h * h + f * f >= 25 && ((e = (180 * Math.atan2(Math.abs(f), Math.abs(h))) / Math.PI), (i.isScrolling = s.isHorizontal() ? e > r.touchAngle : 90 - e > r.touchAngle));
    }
    if ((i.isScrolling && s.emit("touchMoveOpposite", p), void 0 === i.startMoving && ((n.currentX === n.startX && n.currentY === n.startY) || (i.startMoving = !0)), i.isScrolling || ("touchmove" === p.type && i.preventTouchMoveFromPointerMove))) return void (i.isTouched = !1);
    if (!i.startMoving) return;
    (s.allowClick = !1), !r.cssMode && p.cancelable && p.preventDefault(), r.touchMoveStopPropagation && !r.nested && p.stopPropagation();
    let g = s.isHorizontal() ? h : f,
      v = s.isHorizontal() ? n.currentX - n.previousX : n.currentY - n.previousY;
    r.oneWayMovement && ((g = Math.abs(g) * (l ? 1 : -1)), (v = Math.abs(v) * (l ? 1 : -1))), (n.diff = g), (g *= r.touchRatio), l && ((g = -g), (v = -v));
    const w = s.touchesDirection;
    (s.swipeDirection = g > 0 ? "prev" : "next"), (s.touchesDirection = v > 0 ? "prev" : "next");
    const b = s.params.loop && !r.cssMode,
      y = ("next" === s.touchesDirection && s.allowSlideNext) || ("prev" === s.touchesDirection && s.allowSlidePrev);
    if (!i.isMoved) {
      if ((b && y && s.loopFix({ direction: s.swipeDirection }), (i.startTranslate = s.getTranslate()), s.setTransition(0), s.animating)) {
        const e = new window.CustomEvent("transitionend", { bubbles: !0, cancelable: !0, detail: { bySwiperTouchMove: !0 } });
        s.wrapperEl.dispatchEvent(e);
      }
      (i.allowMomentumBounce = !1), !r.grabCursor || (!0 !== s.allowSlideNext && !0 !== s.allowSlidePrev) || s.setGrabCursor(!0), s.emit("sliderFirstMove", p);
    }
    if ((new Date().getTime(), i.isMoved && i.allowThresholdMove && w !== s.touchesDirection && b && y && Math.abs(g) >= 1)) return Object.assign(n, { startX: u, startY: m, currentX: u, currentY: m, startTranslate: i.currentTranslate }), (i.loopSwapReset = !0), void (i.startTranslate = i.currentTranslate);
    s.emit("sliderMove", p), (i.isMoved = !0), (i.currentTranslate = g + i.startTranslate);
    let E = !0,
      x = r.resistanceRatio;
    if (
      (r.touchReleaseOnEdges && (x = 0),
      g > 0 ? (b && y && i.allowThresholdMove && i.currentTranslate > (r.centeredSlides ? s.minTranslate() - s.slidesSizesGrid[s.activeIndex + 1] : s.minTranslate()) && s.loopFix({ direction: "prev", setTranslate: !0, activeSlideIndex: 0 }), i.currentTranslate > s.minTranslate() && ((E = !1), r.resistance && (i.currentTranslate = s.minTranslate() - 1 + (-s.minTranslate() + i.startTranslate + g) ** x))) : g < 0 && (b && y && i.allowThresholdMove && i.currentTranslate < (r.centeredSlides ? s.maxTranslate() + s.slidesSizesGrid[s.slidesSizesGrid.length - 1] : s.maxTranslate()) && s.loopFix({ direction: "next", setTranslate: !0, activeSlideIndex: s.slides.length - ("auto" === r.slidesPerView ? s.slidesPerViewDynamic() : Math.ceil(parseFloat(r.slidesPerView, 10))) }), i.currentTranslate < s.maxTranslate() && ((E = !1), r.resistance && (i.currentTranslate = s.maxTranslate() + 1 - (s.maxTranslate() - i.startTranslate - g) ** x))),
      E && (p.preventedByNestedSwiper = !0),
      !s.allowSlideNext && "next" === s.swipeDirection && i.currentTranslate < i.startTranslate && (i.currentTranslate = i.startTranslate),
      !s.allowSlidePrev && "prev" === s.swipeDirection && i.currentTranslate > i.startTranslate && (i.currentTranslate = i.startTranslate),
      s.allowSlidePrev || s.allowSlideNext || (i.currentTranslate = i.startTranslate),
      r.threshold > 0)
    ) {
      if (!(Math.abs(g) > r.threshold || i.allowThresholdMove)) return void (i.currentTranslate = i.startTranslate);
      if (!i.allowThresholdMove) return (i.allowThresholdMove = !0), (n.startX = n.currentX), (n.startY = n.currentY), (i.currentTranslate = i.startTranslate), void (n.diff = s.isHorizontal() ? n.currentX - n.startX : n.currentY - n.startY);
    }
    r.followFinger && !r.cssMode && (((r.freeMode && r.freeMode.enabled && s.freeMode) || r.watchSlidesProgress) && (s.updateActiveIndex(), s.updateSlidesClasses()), r.freeMode && r.freeMode.enabled && s.freeMode && s.freeMode.onTouchMove(), s.updateProgress(i.currentTranslate), s.setTranslate(i.currentTranslate));
  }
  function V(e) {
    const t = this,
      s = t.touchEventsData;
    let a,
      i = e;
    i.originalEvent && (i = i.originalEvent);
    if ("touchend" === i.type || "touchcancel" === i.type) {
      if (((a = [...i.changedTouches].filter((e) => e.identifier === s.touchId)[0]), !a || a.identifier !== s.touchId)) return;
    } else {
      if (null !== s.touchId) return;
      if (i.pointerId !== s.pointerId) return;
      a = i;
    }
    if (["pointercancel", "pointerout", "pointerleave", "contextmenu"].includes(i.type)) {
      if (!(["pointercancel", "contextmenu"].includes(i.type) && (t.browser.isSafari || t.browser.isWebView))) return;
    }
    (s.pointerId = null), (s.touchId = null);
    const { params: r, touches: n, rtlTranslate: d, slidesGrid: c, enabled: p } = t;
    if (!p) return;
    if (!r.simulateTouch && "mouse" === i.pointerType) return;
    if ((s.allowTouchCallbacks && t.emit("touchEnd", i), (s.allowTouchCallbacks = !1), !s.isTouched)) return s.isMoved && r.grabCursor && t.setGrabCursor(!1), (s.isMoved = !1), void (s.startMoving = !1);
    r.grabCursor && s.isMoved && s.isTouched && (!0 === t.allowSlideNext || !0 === t.allowSlidePrev) && t.setGrabCursor(!1);
    const u = o(),
      m = u - s.touchStartTime;
    if (t.allowClick) {
      const e = i.path || (i.composedPath && i.composedPath());
      t.updateClickedSlide((e && e[0]) || i.target, e), t.emit("tap click", i), m < 300 && u - s.lastClickTime < 300 && t.emit("doubleTap doubleClick", i);
    }
    if (
      ((s.lastClickTime = o()),
      l(() => {
        t.destroyed || (t.allowClick = !0);
      }),
      !s.isTouched || !s.isMoved || !t.swipeDirection || (0 === n.diff && !s.loopSwapReset) || (s.currentTranslate === s.startTranslate && !s.loopSwapReset))
    )
      return (s.isTouched = !1), (s.isMoved = !1), void (s.startMoving = !1);
    let h;
    if (((s.isTouched = !1), (s.isMoved = !1), (s.startMoving = !1), (h = r.followFinger ? (d ? t.translate : -t.translate) : -s.currentTranslate), r.cssMode)) return;
    if (r.freeMode && r.freeMode.enabled) return void t.freeMode.onTouchEnd({ currentPos: h });
    const f = h >= -t.maxTranslate() && !t.params.loop;
    let g = 0,
      v = t.slidesSizesGrid[0];
    for (let e = 0; e < c.length; e += e < r.slidesPerGroupSkip ? 1 : r.slidesPerGroup) {
      const t = e < r.slidesPerGroupSkip - 1 ? 1 : r.slidesPerGroup;
      void 0 !== c[e + t] ? (f || (h >= c[e] && h < c[e + t])) && ((g = e), (v = c[e + t] - c[e])) : (f || h >= c[e]) && ((g = e), (v = c[c.length - 1] - c[c.length - 2]));
    }
    let w = null,
      b = null;
    r.rewind && (t.isBeginning ? (b = r.virtual && r.virtual.enabled && t.virtual ? t.virtual.slides.length - 1 : t.slides.length - 1) : t.isEnd && (w = 0));
    const y = (h - c[g]) / v,
      E = g < r.slidesPerGroupSkip - 1 ? 1 : r.slidesPerGroup;
    if (m > r.longSwipesMs) {
      if (!r.longSwipes) return void t.slideTo(t.activeIndex);
      "next" === t.swipeDirection && (y >= r.longSwipesRatio ? t.slideTo(r.rewind && t.isEnd ? w : g + E) : t.slideTo(g)), "prev" === t.swipeDirection && (y > 1 - r.longSwipesRatio ? t.slideTo(g + E) : null !== b && y < 0 && Math.abs(y) > r.longSwipesRatio ? t.slideTo(b) : t.slideTo(g));
    } else {
      if (!r.shortSwipes) return void t.slideTo(t.activeIndex);
      t.navigation && (i.target === t.navigation.nextEl || i.target === t.navigation.prevEl) ? (i.target === t.navigation.nextEl ? t.slideTo(g + E) : t.slideTo(g)) : ("next" === t.swipeDirection && t.slideTo(null !== w ? w : g + E), "prev" === t.swipeDirection && t.slideTo(null !== b ? b : g));
    }
  }
  function _() {
    const e = this,
      { params: t, el: s } = e;
    if (s && 0 === s.offsetWidth) return;
    t.breakpoints && e.setBreakpoint();
    const { allowSlideNext: a, allowSlidePrev: i, snapGrid: r } = e,
      n = e.virtual && e.params.virtual.enabled;
    (e.allowSlideNext = !0), (e.allowSlidePrev = !0), e.updateSize(), e.updateSlides(), e.updateSlidesClasses();
    const l = n && t.loop;
    !("auto" === t.slidesPerView || t.slidesPerView > 1) || !e.isEnd || e.isBeginning || e.params.centeredSlides || l ? (e.params.loop && !n ? e.slideToLoop(e.realIndex, 0, !1, !0) : e.slideTo(e.activeIndex, 0, !1, !0)) : e.slideTo(e.slides.length - 1, 0, !1, !0),
      e.autoplay &&
        e.autoplay.running &&
        e.autoplay.paused &&
        (clearTimeout(e.autoplay.resizeTimeout),
        (e.autoplay.resizeTimeout = setTimeout(() => {
          e.autoplay && e.autoplay.running && e.autoplay.paused && e.autoplay.resume();
        }, 500))),
      (e.allowSlidePrev = i),
      (e.allowSlideNext = a),
      e.params.watchOverflow && r !== e.snapGrid && e.checkOverflow();
  }
  function W(e) {
    const t = this;
    t.enabled && (t.allowClick || (t.params.preventClicks && e.preventDefault(), t.params.preventClicksPropagation && t.animating && (e.stopPropagation(), e.stopImmediatePropagation())));
  }
  function j() {
    const e = this,
      { wrapperEl: t, rtlTranslate: s, enabled: a } = e;
    if (!a) return;
    let i;
    (e.previousTranslate = e.translate), e.isHorizontal() ? (e.translate = -t.scrollLeft) : (e.translate = -t.scrollTop), 0 === e.translate && (e.translate = 0), e.updateActiveIndex(), e.updateSlidesClasses();
    const r = e.maxTranslate() - e.minTranslate();
    (i = 0 === r ? 0 : (e.translate - e.minTranslate()) / r), i !== e.progress && e.updateProgress(s ? -e.translate : e.translate), e.emit("setTranslate", e.translate, !1);
  }
  function U(e) {
    const t = this;
    O(t, e.target), t.params.cssMode || ("auto" !== t.params.slidesPerView && !t.params.autoHeight) || t.update();
  }
  function K() {
    const e = this;
    e.documentTouchHandlerProceeded || ((e.documentTouchHandlerProceeded = !0), e.params.touchReleaseOnEdges && (e.el.style.touchAction = "auto"));
  }
  const Z = (e, t) => {
    const s = a(),
      { params: i, el: r, wrapperEl: n, device: l } = e,
      o = !!i.nested,
      d = "on" === t ? "addEventListener" : "removeEventListener",
      c = t;
    r &&
      "string" != typeof r &&
      (s[d]("touchstart", e.onDocumentTouchStart, { passive: !1, capture: o }), r[d]("touchstart", e.onTouchStart, { passive: !1 }), r[d]("pointerdown", e.onTouchStart, { passive: !1 }), s[d]("touchmove", e.onTouchMove, { passive: !1, capture: o }), s[d]("pointermove", e.onTouchMove, { passive: !1, capture: o }), s[d]("touchend", e.onTouchEnd, { passive: !0 }), s[d]("pointerup", e.onTouchEnd, { passive: !0 }), s[d]("pointercancel", e.onTouchEnd, { passive: !0 }), s[d]("touchcancel", e.onTouchEnd, { passive: !0 }), s[d]("pointerout", e.onTouchEnd, { passive: !0 }), s[d]("pointerleave", e.onTouchEnd, { passive: !0 }), s[d]("contextmenu", e.onTouchEnd, { passive: !0 }), (i.preventClicks || i.preventClicksPropagation) && r[d]("click", e.onClick, !0), i.cssMode && n[d]("scroll", e.onScroll), i.updateOnWindowResize ? e[c](l.ios || l.android ? "resize orientationchange observerUpdate" : "resize observerUpdate", _, !0) : e[c]("observerUpdate", _, !0), r[d]("load", e.onLoad, { capture: !0 }));
  };
  const Q = (e, t) => e.grid && t.grid && t.grid.rows > 1;
  var J = {
    init: !0,
    direction: "horizontal",
    oneWayMovement: !1,
    swiperElementNodeName: "SWIPER-CONTAINER",
    touchEventsTarget: "wrapper",
    initialSlide: 0,
    speed: 300,
    cssMode: !1,
    updateOnWindowResize: !0,
    resizeObserver: !0,
    nested: !1,
    createElements: !1,
    eventsPrefix: "swiper",
    enabled: !0,
    focusableElements: "input, select, option, textarea, button, video, label",
    width: null,
    height: null,
    preventInteractionOnTransition: !1,
    userAgent: null,
    url: null,
    edgeSwipeDetection: !1,
    edgeSwipeThreshold: 20,
    autoHeight: !1,
    setWrapperSize: !1,
    virtualTranslate: !1,
    effect: "slide",
    breakpoints: void 0,
    breakpointsBase: "window",
    spaceBetween: 0,
    slidesPerView: 1,
    slidesPerGroup: 1,
    slidesPerGroupSkip: 0,
    slidesPerGroupAuto: !1,
    centeredSlides: !1,
    centeredSlidesBounds: !1,
    slidesOffsetBefore: 0,
    slidesOffsetAfter: 0,
    normalizeSlideIndex: !0,
    centerInsufficientSlides: !1,
    watchOverflow: !0,
    roundLengths: !1,
    touchRatio: 1,
    touchAngle: 45,
    simulateTouch: !0,
    shortSwipes: !0,
    longSwipes: !0,
    longSwipesRatio: 0.5,
    longSwipesMs: 300,
    followFinger: !0,
    allowTouchMove: !0,
    threshold: 5,
    touchMoveStopPropagation: !1,
    touchStartPreventDefault: !0,
    touchStartForcePreventDefault: !1,
    touchReleaseOnEdges: !1,
    uniqueNavElements: !0,
    resistance: !0,
    resistanceRatio: 0.85,
    watchSlidesProgress: !1,
    grabCursor: !1,
    preventClicks: !0,
    preventClicksPropagation: !0,
    slideToClickedSlide: !1,
    loop: !1,
    loopAddBlankSlides: !0,
    loopAdditionalSlides: 0,
    loopPreventsSliding: !0,
    rewind: !1,
    allowSlidePrev: !0,
    allowSlideNext: !0,
    swipeHandler: null,
    noSwiping: !0,
    noSwipingClass: "swiper-no-swiping",
    noSwipingSelector: null,
    passiveListeners: !0,
    maxBackfaceHiddenSlides: 10,
    containerModifierClass: "swiper-",
    slideClass: "swiper-slide",
    slideBlankClass: "swiper-slide-blank",
    slideActiveClass: "swiper-slide-active",
    slideVisibleClass: "swiper-slide-visible",
    slideFullyVisibleClass: "swiper-slide-fully-visible",
    slideNextClass: "swiper-slide-next",
    slidePrevClass: "swiper-slide-prev",
    wrapperClass: "swiper-wrapper",
    lazyPreloaderClass: "swiper-lazy-preloader",
    lazyPreloadPrevNext: 0,
    runCallbacksOnInit: !0,
    _emitClasses: !1,
  };
  function ee(e, t) {
    return function (s) {
      void 0 === s && (s = {});
      const a = Object.keys(s)[0],
        i = s[a];
      "object" == typeof i && null !== i ? (!0 === e[a] && (e[a] = { enabled: !0 }), "navigation" === a && e[a] && e[a].enabled && !e[a].prevEl && !e[a].nextEl && (e[a].auto = !0), ["pagination", "scrollbar"].indexOf(a) >= 0 && e[a] && e[a].enabled && !e[a].el && (e[a].auto = !0), a in e && "enabled" in i ? ("object" != typeof e[a] || "enabled" in e[a] || (e[a].enabled = !0), e[a] || (e[a] = { enabled: !1 }), p(t, s)) : p(t, s)) : p(t, s);
    };
  }
  const te = {
      eventsEmitter: z,
      update: H,
      translate: N,
      transition: {
        setTransition: function (e, t) {
          const s = this;
          s.params.cssMode || ((s.wrapperEl.style.transitionDuration = `${e}ms`), (s.wrapperEl.style.transitionDelay = 0 === e ? "0ms" : "")), s.emit("setTransition", e, t);
        },
        transitionStart: function (e, t) {
          void 0 === e && (e = !0);
          const s = this,
            { params: a } = s;
          a.cssMode || (a.autoHeight && s.updateAutoHeight(), X({ swiper: s, runCallbacks: e, direction: t, step: "Start" }));
        },
        transitionEnd: function (e, t) {
          void 0 === e && (e = !0);
          const s = this,
            { params: a } = s;
          (s.animating = !1), a.cssMode || (s.setTransition(0), X({ swiper: s, runCallbacks: e, direction: t, step: "End" }));
        },
      },
      slide: B,
      loop: Y,
      grabCursor: {
        setGrabCursor: function (e) {
          const t = this;
          if (!t.params.simulateTouch || (t.params.watchOverflow && t.isLocked) || t.params.cssMode) return;
          const s = "container" === t.params.touchEventsTarget ? t.el : t.wrapperEl;
          t.isElement && (t.__preventObserver__ = !0),
            (s.style.cursor = "move"),
            (s.style.cursor = e ? "grabbing" : "grab"),
            t.isElement &&
              requestAnimationFrame(() => {
                t.__preventObserver__ = !1;
              });
        },
        unsetGrabCursor: function () {
          const e = this;
          (e.params.watchOverflow && e.isLocked) ||
            e.params.cssMode ||
            (e.isElement && (e.__preventObserver__ = !0),
            (e["container" === e.params.touchEventsTarget ? "el" : "wrapperEl"].style.cursor = ""),
            e.isElement &&
              requestAnimationFrame(() => {
                e.__preventObserver__ = !1;
              }));
        },
      },
      events: {
        attachEvents: function () {
          const e = this,
            { params: t } = e;
          (e.onTouchStart = F.bind(e)), (e.onTouchMove = q.bind(e)), (e.onTouchEnd = V.bind(e)), (e.onDocumentTouchStart = K.bind(e)), t.cssMode && (e.onScroll = j.bind(e)), (e.onClick = W.bind(e)), (e.onLoad = U.bind(e)), Z(e, "on");
        },
        detachEvents: function () {
          Z(this, "off");
        },
      },
      breakpoints: {
        setBreakpoint: function () {
          const e = this,
            { realIndex: t, initialized: s, params: a, el: i } = e,
            r = a.breakpoints;
          if (!r || (r && 0 === Object.keys(r).length)) return;
          const n = e.getBreakpoint(r, e.params.breakpointsBase, e.el);
          if (!n || e.currentBreakpoint === n) return;
          const l = (n in r ? r[n] : void 0) || e.originalParams,
            o = Q(e, a),
            d = Q(e, l),
            c = e.params.grabCursor,
            u = l.grabCursor,
            m = a.enabled;
          o && !d ? (i.classList.remove(`${a.containerModifierClass}grid`, `${a.containerModifierClass}grid-column`), e.emitContainerClasses()) : !o && d && (i.classList.add(`${a.containerModifierClass}grid`), ((l.grid.fill && "column" === l.grid.fill) || (!l.grid.fill && "column" === a.grid.fill)) && i.classList.add(`${a.containerModifierClass}grid-column`), e.emitContainerClasses()),
            c && !u ? e.unsetGrabCursor() : !c && u && e.setGrabCursor(),
            ["navigation", "pagination", "scrollbar"].forEach((t) => {
              if (void 0 === l[t]) return;
              const s = a[t] && a[t].enabled,
                i = l[t] && l[t].enabled;
              s && !i && e[t].disable(), !s && i && e[t].enable();
            });
          const h = l.direction && l.direction !== a.direction,
            f = a.loop && (l.slidesPerView !== a.slidesPerView || h),
            g = a.loop;
          h && s && e.changeDirection(), p(e.params, l);
          const v = e.params.enabled,
            w = e.params.loop;
          Object.assign(e, { allowTouchMove: e.params.allowTouchMove, allowSlideNext: e.params.allowSlideNext, allowSlidePrev: e.params.allowSlidePrev }), m && !v ? e.disable() : !m && v && e.enable(), (e.currentBreakpoint = n), e.emit("_beforeBreakpoint", l), s && (f ? (e.loopDestroy(), e.loopCreate(t), e.updateSlides()) : !g && w ? (e.loopCreate(t), e.updateSlides()) : g && !w && e.loopDestroy()), e.emit("breakpoint", l);
        },
        getBreakpoint: function (e, t, s) {
          if ((void 0 === t && (t = "window"), !e || ("container" === t && !s))) return;
          let a = !1;
          const i = r(),
            n = "window" === t ? i.innerHeight : s.clientHeight,
            l = Object.keys(e).map((e) => {
              if ("string" == typeof e && 0 === e.indexOf("@")) {
                const t = parseFloat(e.substr(1));
                return { value: n * t, point: e };
              }
              return { value: e, point: e };
            });
          l.sort((e, t) => parseInt(e.value, 10) - parseInt(t.value, 10));
          for (let e = 0; e < l.length; e += 1) {
            const { point: r, value: n } = l[e];
            "window" === t ? i.matchMedia(`(min-width: ${n}px)`).matches && (a = r) : n <= s.clientWidth && (a = r);
          }
          return a || "max";
        },
      },
      checkOverflow: {
        checkOverflow: function () {
          const e = this,
            { isLocked: t, params: s } = e,
            { slidesOffsetBefore: a } = s;
          if (a) {
            const t = e.slides.length - 1,
              s = e.slidesGrid[t] + e.slidesSizesGrid[t] + 2 * a;
            e.isLocked = e.size > s;
          } else e.isLocked = 1 === e.snapGrid.length;
          !0 === s.allowSlideNext && (e.allowSlideNext = !e.isLocked), !0 === s.allowSlidePrev && (e.allowSlidePrev = !e.isLocked), t && t !== e.isLocked && (e.isEnd = !1), t !== e.isLocked && e.emit(e.isLocked ? "lock" : "unlock");
        },
      },
      classes: {
        addClasses: function () {
          const e = this,
            { classNames: t, params: s, rtl: a, el: i, device: r } = e,
            n = (function (e, t) {
              const s = [];
              return (
                e.forEach((e) => {
                  "object" == typeof e
                    ? Object.keys(e).forEach((a) => {
                        e[a] && s.push(t + a);
                      })
                    : "string" == typeof e && s.push(t + e);
                }),
                s
              );
            })(["initialized", s.direction, { "free-mode": e.params.freeMode && s.freeMode.enabled }, { autoheight: s.autoHeight }, { rtl: a }, { grid: s.grid && s.grid.rows > 1 }, { "grid-column": s.grid && s.grid.rows > 1 && "column" === s.grid.fill }, { android: r.android }, { ios: r.ios }, { "css-mode": s.cssMode }, { centered: s.cssMode && s.centeredSlides }, { "watch-progress": s.watchSlidesProgress }], s.containerModifierClass);
          t.push(...n), i.classList.add(...t), e.emitContainerClasses();
        },
        removeClasses: function () {
          const { el: e, classNames: t } = this;
          e && "string" != typeof e && (e.classList.remove(...t), this.emitContainerClasses());
        },
      },
    },
    se = {};
  class ae {
    constructor() {
      let e, t;
      for (var s = arguments.length, i = new Array(s), r = 0; r < s; r++) i[r] = arguments[r];
      1 === i.length && i[0].constructor && "Object" === Object.prototype.toString.call(i[0]).slice(8, -1) ? (t = i[0]) : ([e, t] = i), t || (t = {}), (t = p({}, t)), e && !t.el && (t.el = e);
      const n = a();
      if (t.el && "string" == typeof t.el && n.querySelectorAll(t.el).length > 1) {
        const e = [];
        return (
          n.querySelectorAll(t.el).forEach((s) => {
            const a = p({}, t, { el: s });
            e.push(new ae(a));
          }),
          e
        );
      }
      const l = this;
      (l.__swiper__ = !0), (l.support = L()), (l.device = I({ userAgent: t.userAgent })), (l.browser = A()), (l.eventsListeners = {}), (l.eventsAnyListeners = []), (l.modules = [...l.__modules__]), t.modules && Array.isArray(t.modules) && l.modules.push(...t.modules);
      const o = {};
      l.modules.forEach((e) => {
        e({ params: t, swiper: l, extendParams: ee(t, o), on: l.on.bind(l), once: l.once.bind(l), off: l.off.bind(l), emit: l.emit.bind(l) });
      });
      const d = p({}, J, o);
      return (
        (l.params = p({}, d, se, t)),
        (l.originalParams = p({}, l.params)),
        (l.passedParams = p({}, t)),
        l.params &&
          l.params.on &&
          Object.keys(l.params.on).forEach((e) => {
            l.on(e, l.params.on[e]);
          }),
        l.params && l.params.onAny && l.onAny(l.params.onAny),
        Object.assign(l, {
          enabled: l.params.enabled,
          el: e,
          classNames: [],
          slides: [],
          slidesGrid: [],
          snapGrid: [],
          slidesSizesGrid: [],
          isHorizontal: () => "horizontal" === l.params.direction,
          isVertical: () => "vertical" === l.params.direction,
          activeIndex: 0,
          realIndex: 0,
          isBeginning: !0,
          isEnd: !1,
          translate: 0,
          previousTranslate: 0,
          progress: 0,
          velocity: 0,
          animating: !1,
          cssOverflowAdjustment() {
            return Math.trunc(this.translate / 2 ** 23) * 2 ** 23;
          },
          allowSlideNext: l.params.allowSlideNext,
          allowSlidePrev: l.params.allowSlidePrev,
          touchEventsData: { isTouched: void 0, isMoved: void 0, allowTouchCallbacks: void 0, touchStartTime: void 0, isScrolling: void 0, currentTranslate: void 0, startTranslate: void 0, allowThresholdMove: void 0, focusableElements: l.params.focusableElements, lastClickTime: 0, clickTimeout: void 0, velocities: [], allowMomentumBounce: void 0, startMoving: void 0, pointerId: null, touchId: null },
          allowClick: !0,
          allowTouchMove: l.params.allowTouchMove,
          touches: { startX: 0, startY: 0, currentX: 0, currentY: 0, diff: 0 },
          imagesToLoad: [],
          imagesLoaded: 0,
        }),
        l.emit("_swiper"),
        l.params.init && l.init(),
        l
      );
    }
    getDirectionLabel(e) {
      return this.isHorizontal() ? e : { width: "height", "margin-top": "margin-left", "margin-bottom ": "margin-right", "margin-left": "margin-top", "margin-right": "margin-bottom", "padding-left": "padding-top", "padding-right": "padding-bottom", marginRight: "marginBottom" }[e];
    }
    getSlideIndex(e) {
      const { slidesEl: t, params: s } = this,
        a = y(f(t, `.${s.slideClass}, swiper-slide`)[0]);
      return y(e) - a;
    }
    getSlideIndexByData(e) {
      return this.getSlideIndex(this.slides.filter((t) => 1 * t.getAttribute("data-swiper-slide-index") === e)[0]);
    }
    recalcSlides() {
      const { slidesEl: e, params: t } = this;
      this.slides = f(e, `.${t.slideClass}, swiper-slide`);
    }
    enable() {
      const e = this;
      e.enabled || ((e.enabled = !0), e.params.grabCursor && e.setGrabCursor(), e.emit("enable"));
    }
    disable() {
      const e = this;
      e.enabled && ((e.enabled = !1), e.params.grabCursor && e.unsetGrabCursor(), e.emit("disable"));
    }
    setProgress(e, t) {
      const s = this;
      e = Math.min(Math.max(e, 0), 1);
      const a = s.minTranslate(),
        i = (s.maxTranslate() - a) * e + a;
      s.translateTo(i, void 0 === t ? 0 : t), s.updateActiveIndex(), s.updateSlidesClasses();
    }
    emitContainerClasses() {
      const e = this;
      if (!e.params._emitClasses || !e.el) return;
      const t = e.el.className.split(" ").filter((t) => 0 === t.indexOf("swiper") || 0 === t.indexOf(e.params.containerModifierClass));
      e.emit("_containerClasses", t.join(" "));
    }
    getSlideClasses(e) {
      const t = this;
      return t.destroyed
        ? ""
        : e.className
            .split(" ")
            .filter((e) => 0 === e.indexOf("swiper-slide") || 0 === e.indexOf(t.params.slideClass))
            .join(" ");
    }
    emitSlidesClasses() {
      const e = this;
      if (!e.params._emitClasses || !e.el) return;
      const t = [];
      e.slides.forEach((s) => {
        const a = e.getSlideClasses(s);
        t.push({ slideEl: s, classNames: a }), e.emit("_slideClass", s, a);
      }),
        e.emit("_slideClasses", t);
    }
    slidesPerViewDynamic(e, t) {
      void 0 === e && (e = "current"), void 0 === t && (t = !1);
      const { params: s, slides: a, slidesGrid: i, slidesSizesGrid: r, size: n, activeIndex: l } = this;
      let o = 1;
      if ("number" == typeof s.slidesPerView) return s.slidesPerView;
      if (s.centeredSlides) {
        let e,
          t = a[l] ? Math.ceil(a[l].swiperSlideSize) : 0;
        for (let s = l + 1; s < a.length; s += 1) a[s] && !e && ((t += Math.ceil(a[s].swiperSlideSize)), (o += 1), t > n && (e = !0));
        for (let s = l - 1; s >= 0; s -= 1) a[s] && !e && ((t += a[s].swiperSlideSize), (o += 1), t > n && (e = !0));
      } else if ("current" === e)
        for (let e = l + 1; e < a.length; e += 1) {
          (t ? i[e] + r[e] - i[l] < n : i[e] - i[l] < n) && (o += 1);
        }
      else
        for (let e = l - 1; e >= 0; e -= 1) {
          i[l] - i[e] < n && (o += 1);
        }
      return o;
    }
    update() {
      const e = this;
      if (!e || e.destroyed) return;
      const { snapGrid: t, params: s } = e;
      function a() {
        const t = e.rtlTranslate ? -1 * e.translate : e.translate,
          s = Math.min(Math.max(t, e.maxTranslate()), e.minTranslate());
        e.setTranslate(s), e.updateActiveIndex(), e.updateSlidesClasses();
      }
      let i;
      if (
        (s.breakpoints && e.setBreakpoint(),
        [...e.el.querySelectorAll('[loading="lazy"]')].forEach((t) => {
          t.complete && O(e, t);
        }),
        e.updateSize(),
        e.updateSlides(),
        e.updateProgress(),
        e.updateSlidesClasses(),
        s.freeMode && s.freeMode.enabled && !s.cssMode)
      )
        a(), s.autoHeight && e.updateAutoHeight();
      else {
        if (("auto" === s.slidesPerView || s.slidesPerView > 1) && e.isEnd && !s.centeredSlides) {
          const t = e.virtual && s.virtual.enabled ? e.virtual.slides : e.slides;
          i = e.slideTo(t.length - 1, 0, !1, !0);
        } else i = e.slideTo(e.activeIndex, 0, !1, !0);
        i || a();
      }
      s.watchOverflow && t !== e.snapGrid && e.checkOverflow(), e.emit("update");
    }
    changeDirection(e, t) {
      void 0 === t && (t = !0);
      const s = this,
        a = s.params.direction;
      return (
        e || (e = "horizontal" === a ? "vertical" : "horizontal"),
        e === a ||
          ("horizontal" !== e && "vertical" !== e) ||
          (s.el.classList.remove(`${s.params.containerModifierClass}${a}`),
          s.el.classList.add(`${s.params.containerModifierClass}${e}`),
          s.emitContainerClasses(),
          (s.params.direction = e),
          s.slides.forEach((t) => {
            "vertical" === e ? (t.style.width = "") : (t.style.height = "");
          }),
          s.emit("changeDirection"),
          t && s.update()),
        s
      );
    }
    changeLanguageDirection(e) {
      const t = this;
      (t.rtl && "rtl" === e) || (!t.rtl && "ltr" === e) || ((t.rtl = "rtl" === e), (t.rtlTranslate = "horizontal" === t.params.direction && t.rtl), t.rtl ? (t.el.classList.add(`${t.params.containerModifierClass}rtl`), (t.el.dir = "rtl")) : (t.el.classList.remove(`${t.params.containerModifierClass}rtl`), (t.el.dir = "ltr")), t.update());
    }
    mount(e) {
      const t = this;
      if (t.mounted) return !0;
      let s = e || t.params.el;
      if (("string" == typeof s && (s = document.querySelector(s)), !s)) return !1;
      (s.swiper = t), s.parentNode && s.parentNode.host && s.parentNode.host.nodeName === t.params.swiperElementNodeName.toUpperCase() && (t.isElement = !0);
      const a = () => `.${(t.params.wrapperClass || "").trim().split(" ").join(".")}`;
      let i = (() => {
        if (s && s.shadowRoot && s.shadowRoot.querySelector) {
          return s.shadowRoot.querySelector(a());
        }
        return f(s, a())[0];
      })();
      return (
        !i &&
          t.params.createElements &&
          ((i = v("div", t.params.wrapperClass)),
          s.append(i),
          f(s, `.${t.params.slideClass}`).forEach((e) => {
            i.append(e);
          })),
        Object.assign(t, { el: s, wrapperEl: i, slidesEl: t.isElement && !s.parentNode.host.slideSlots ? s.parentNode.host : i, hostEl: t.isElement ? s.parentNode.host : s, mounted: !0, rtl: "rtl" === s.dir.toLowerCase() || "rtl" === b(s, "direction"), rtlTranslate: "horizontal" === t.params.direction && ("rtl" === s.dir.toLowerCase() || "rtl" === b(s, "direction")), wrongRTL: "-webkit-box" === b(i, "display") }),
        !0
      );
    }
    init(e) {
      const t = this;
      if (t.initialized) return t;
      if (!1 === t.mount(e)) return t;
      t.emit("beforeInit"), t.params.breakpoints && t.setBreakpoint(), t.addClasses(), t.updateSize(), t.updateSlides(), t.params.watchOverflow && t.checkOverflow(), t.params.grabCursor && t.enabled && t.setGrabCursor(), t.params.loop && t.virtual && t.params.virtual.enabled ? t.slideTo(t.params.initialSlide + t.virtual.slidesBefore, 0, t.params.runCallbacksOnInit, !1, !0) : t.slideTo(t.params.initialSlide, 0, t.params.runCallbacksOnInit, !1, !0), t.params.loop && t.loopCreate(), t.attachEvents();
      const s = [...t.el.querySelectorAll('[loading="lazy"]')];
      return (
        t.isElement && s.push(...t.hostEl.querySelectorAll('[loading="lazy"]')),
        s.forEach((e) => {
          e.complete
            ? O(t, e)
            : e.addEventListener("load", (e) => {
                O(t, e.target);
              });
        }),
        G(t),
        (t.initialized = !0),
        G(t),
        t.emit("init"),
        t.emit("afterInit"),
        t
      );
    }
    destroy(e, t) {
      void 0 === e && (e = !0), void 0 === t && (t = !0);
      const s = this,
        { params: a, el: i, wrapperEl: r, slides: n } = s;
      return (
        void 0 === s.params ||
          s.destroyed ||
          (s.emit("beforeDestroy"),
          (s.initialized = !1),
          s.detachEvents(),
          a.loop && s.loopDestroy(),
          t &&
            (s.removeClasses(),
            i && "string" != typeof i && i.removeAttribute("style"),
            r && r.removeAttribute("style"),
            n &&
              n.length &&
              n.forEach((e) => {
                e.classList.remove(a.slideVisibleClass, a.slideFullyVisibleClass, a.slideActiveClass, a.slideNextClass, a.slidePrevClass), e.removeAttribute("style"), e.removeAttribute("data-swiper-slide-index");
              })),
          s.emit("destroy"),
          Object.keys(s.eventsListeners).forEach((e) => {
            s.off(e);
          }),
          !1 !== e &&
            (s.el && "string" != typeof s.el && (s.el.swiper = null),
            (function (e) {
              const t = e;
              Object.keys(t).forEach((e) => {
                try {
                  t[e] = null;
                } catch (e) {}
                try {
                  delete t[e];
                } catch (e) {}
              });
            })(s)),
          (s.destroyed = !0)),
        null
      );
    }
    static extendDefaults(e) {
      p(se, e);
    }
    static get extendedDefaults() {
      return se;
    }
    static get defaults() {
      return J;
    }
    static installModule(e) {
      ae.prototype.__modules__ || (ae.prototype.__modules__ = []);
      const t = ae.prototype.__modules__;
      "function" == typeof e && t.indexOf(e) < 0 && t.push(e);
    }
    static use(e) {
      return Array.isArray(e) ? (e.forEach((e) => ae.installModule(e)), ae) : (ae.installModule(e), ae);
    }
  }
  function ie(e, t, s, a) {
    return (
      e.params.createElements &&
        Object.keys(a).forEach((i) => {
          if (!s[i] && !0 === s.auto) {
            let r = f(e.el, `.${a[i]}`)[0];
            r || ((r = v("div", a[i])), (r.className = a[i]), e.el.append(r)), (s[i] = r), (t[i] = r);
          }
        }),
      s
    );
  }
  function re(e) {
    return (
      void 0 === e && (e = ""),
      `.${e
        .trim()
        .replace(/([\.:!+\/])/g, "\\$1")
        .replace(/ /g, ".")}`
    );
  }
  function ne(e) {
    const t = this,
      { params: s, slidesEl: a } = t;
    s.loop && t.loopDestroy();
    const i = (e) => {
      if ("string" == typeof e) {
        const t = document.createElement("div");
        (t.innerHTML = e), a.append(t.children[0]), (t.innerHTML = "");
      } else a.append(e);
    };
    if ("object" == typeof e && "length" in e) for (let t = 0; t < e.length; t += 1) e[t] && i(e[t]);
    else i(e);
    t.recalcSlides(), s.loop && t.loopCreate(), (s.observer && !t.isElement) || t.update();
  }
  function le(e) {
    const t = this,
      { params: s, activeIndex: a, slidesEl: i } = t;
    s.loop && t.loopDestroy();
    let r = a + 1;
    const n = (e) => {
      if ("string" == typeof e) {
        const t = document.createElement("div");
        (t.innerHTML = e), i.prepend(t.children[0]), (t.innerHTML = "");
      } else i.prepend(e);
    };
    if ("object" == typeof e && "length" in e) {
      for (let t = 0; t < e.length; t += 1) e[t] && n(e[t]);
      r = a + e.length;
    } else n(e);
    t.recalcSlides(), s.loop && t.loopCreate(), (s.observer && !t.isElement) || t.update(), t.slideTo(r, 0, !1);
  }
  function oe(e, t) {
    const s = this,
      { params: a, activeIndex: i, slidesEl: r } = s;
    let n = i;
    a.loop && ((n -= s.loopedSlides), s.loopDestroy(), s.recalcSlides());
    const l = s.slides.length;
    if (e <= 0) return void s.prependSlide(t);
    if (e >= l) return void s.appendSlide(t);
    let o = n > e ? n + 1 : n;
    const d = [];
    for (let t = l - 1; t >= e; t -= 1) {
      const e = s.slides[t];
      e.remove(), d.unshift(e);
    }
    if ("object" == typeof t && "length" in t) {
      for (let e = 0; e < t.length; e += 1) t[e] && r.append(t[e]);
      o = n > e ? n + t.length : n;
    } else r.append(t);
    for (let e = 0; e < d.length; e += 1) r.append(d[e]);
    s.recalcSlides(), a.loop && s.loopCreate(), (a.observer && !s.isElement) || s.update(), a.loop ? s.slideTo(o + s.loopedSlides, 0, !1) : s.slideTo(o, 0, !1);
  }
  function de(e) {
    const t = this,
      { params: s, activeIndex: a } = t;
    let i = a;
    s.loop && ((i -= t.loopedSlides), t.loopDestroy());
    let r,
      n = i;
    if ("object" == typeof e && "length" in e) {
      for (let s = 0; s < e.length; s += 1) (r = e[s]), t.slides[r] && t.slides[r].remove(), r < n && (n -= 1);
      n = Math.max(n, 0);
    } else (r = e), t.slides[r] && t.slides[r].remove(), r < n && (n -= 1), (n = Math.max(n, 0));
    t.recalcSlides(), s.loop && t.loopCreate(), (s.observer && !t.isElement) || t.update(), s.loop ? t.slideTo(n + t.loopedSlides, 0, !1) : t.slideTo(n, 0, !1);
  }
  function ce() {
    const e = this,
      t = [];
    for (let s = 0; s < e.slides.length; s += 1) t.push(s);
    e.removeSlide(t);
  }
  function pe(e) {
    const { effect: t, swiper: s, on: a, setTranslate: i, setTransition: r, overwriteParams: n, perspective: l, recreateShadows: o, getEffectParams: d } = e;
    let c;
    a("beforeInit", () => {
      if (s.params.effect !== t) return;
      s.classNames.push(`${s.params.containerModifierClass}${t}`), l && l() && s.classNames.push(`${s.params.containerModifierClass}3d`);
      const e = n ? n() : {};
      Object.assign(s.params, e), Object.assign(s.originalParams, e);
    }),
      a("setTranslate", () => {
        s.params.effect === t && i();
      }),
      a("setTransition", (e, a) => {
        s.params.effect === t && r(a);
      }),
      a("transitionEnd", () => {
        if (s.params.effect === t && o) {
          if (!d || !d().slideShadows) return;
          s.slides.forEach((e) => {
            e.querySelectorAll(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").forEach((e) => e.remove());
          }),
            o();
        }
      }),
      a("virtualUpdate", () => {
        s.params.effect === t &&
          (s.slides.length || (c = !0),
          requestAnimationFrame(() => {
            c && s.slides && s.slides.length && (i(), (c = !1));
          }));
      });
  }
  function ue(e, t) {
    const s = h(t);
    return s !== t && ((s.style.backfaceVisibility = "hidden"), (s.style["-webkit-backface-visibility"] = "hidden")), s;
  }
  function me(e) {
    let { swiper: t, duration: s, transformElements: a, allSlides: i } = e;
    const { activeIndex: r } = t;
    if (t.params.virtualTranslate && 0 !== s) {
      let e,
        s = !1;
      (e = i
        ? a
        : a.filter((e) => {
            const s = e.classList.contains("swiper-slide-transform")
              ? ((e) => {
                  if (!e.parentElement) return t.slides.filter((t) => t.shadowRoot && t.shadowRoot === e.parentNode)[0];
                  return e.parentElement;
                })(e)
              : e;
            return t.getSlideIndex(s) === r;
          })),
        e.forEach((e) => {
          x(e, () => {
            if (s) return;
            if (!t || t.destroyed) return;
            (s = !0), (t.animating = !1);
            const e = new window.CustomEvent("transitionend", { bubbles: !0, cancelable: !0 });
            t.wrapperEl.dispatchEvent(e);
          });
        });
    }
  }
  function he(e, t, s) {
    const a = `swiper-slide-shadow${s ? `-${s}` : ""}${e ? ` swiper-slide-shadow-${e}` : ""}`,
      i = h(t);
    let r = i.querySelector(`.${a.split(" ").join(".")}`);
    return r || ((r = v("div", a.split(" "))), i.append(r)), r;
  }
  Object.keys(te).forEach((e) => {
    Object.keys(te[e]).forEach((t) => {
      ae.prototype[t] = te[e][t];
    });
  }),
    ae.use([
      function (e) {
        let { swiper: t, on: s, emit: a } = e;
        const i = r();
        let n = null,
          l = null;
        const o = () => {
            t && !t.destroyed && t.initialized && (a("beforeResize"), a("resize"));
          },
          d = () => {
            t && !t.destroyed && t.initialized && a("orientationchange");
          };
        s("init", () => {
          t.params.resizeObserver && void 0 !== i.ResizeObserver
            ? t &&
              !t.destroyed &&
              t.initialized &&
              ((n = new ResizeObserver((e) => {
                l = i.requestAnimationFrame(() => {
                  const { width: s, height: a } = t;
                  let i = s,
                    r = a;
                  e.forEach((e) => {
                    let { contentBoxSize: s, contentRect: a, target: n } = e;
                    (n && n !== t.el) || ((i = a ? a.width : (s[0] || s).inlineSize), (r = a ? a.height : (s[0] || s).blockSize));
                  }),
                    (i === s && r === a) || o();
                });
              })),
              n.observe(t.el))
            : (i.addEventListener("resize", o), i.addEventListener("orientationchange", d));
        }),
          s("destroy", () => {
            l && i.cancelAnimationFrame(l), n && n.unobserve && t.el && (n.unobserve(t.el), (n = null)), i.removeEventListener("resize", o), i.removeEventListener("orientationchange", d);
          });
      },
      function (e) {
        let { swiper: t, extendParams: s, on: a, emit: i } = e;
        const n = [],
          l = r(),
          o = function (e, s) {
            void 0 === s && (s = {});
            const a = new (l.MutationObserver || l.WebkitMutationObserver)((e) => {
              if (t.__preventObserver__) return;
              if (1 === e.length) return void i("observerUpdate", e[0]);
              const s = function () {
                i("observerUpdate", e[0]);
              };
              l.requestAnimationFrame ? l.requestAnimationFrame(s) : l.setTimeout(s, 0);
            });
            a.observe(e, { attributes: void 0 === s.attributes || s.attributes, childList: void 0 === s.childList || s.childList, characterData: void 0 === s.characterData || s.characterData }), n.push(a);
          };
        s({ observer: !1, observeParents: !1, observeSlideChildren: !1 }),
          a("init", () => {
            if (t.params.observer) {
              if (t.params.observeParents) {
                const e = E(t.hostEl);
                for (let t = 0; t < e.length; t += 1) o(e[t]);
              }
              o(t.hostEl, { childList: t.params.observeSlideChildren }), o(t.wrapperEl, { attributes: !1 });
            }
          }),
          a("destroy", () => {
            n.forEach((e) => {
              e.disconnect();
            }),
              n.splice(0, n.length);
          });
      },
    ]);
  const fe = [
    function (e) {
      let t,
        { swiper: s, extendParams: i, on: r, emit: n } = e;
      i({ virtual: { enabled: !1, slides: [], cache: !0, renderSlide: null, renderExternal: null, renderExternalUpdate: !0, addSlidesBefore: 0, addSlidesAfter: 0 } });
      const l = a();
      s.virtual = { cache: {}, from: void 0, to: void 0, slides: [], offset: 0, slidesGrid: [] };
      const o = l.createElement("div");
      function d(e, t) {
        const a = s.params.virtual;
        if (a.cache && s.virtual.cache[t]) return s.virtual.cache[t];
        let i;
        return a.renderSlide ? ((i = a.renderSlide.call(s, e, t)), "string" == typeof i && ((o.innerHTML = i), (i = o.children[0]))) : (i = s.isElement ? v("swiper-slide") : v("div", s.params.slideClass)), i.setAttribute("data-swiper-slide-index", t), a.renderSlide || (i.innerHTML = e), a.cache && (s.virtual.cache[t] = i), i;
      }
      function c(e, t) {
        const { slidesPerView: a, slidesPerGroup: i, centeredSlides: r, loop: l, initialSlide: o } = s.params;
        if (t && !l && o > 0) return;
        const { addSlidesBefore: c, addSlidesAfter: p } = s.params.virtual,
          { from: u, to: m, slides: h, slidesGrid: g, offset: v } = s.virtual;
        s.params.cssMode || s.updateActiveIndex();
        const w = s.activeIndex || 0;
        let b, y, E;
        (b = s.rtlTranslate ? "right" : s.isHorizontal() ? "left" : "top"), r ? ((y = Math.floor(a / 2) + i + p), (E = Math.floor(a / 2) + i + c)) : ((y = a + (i - 1) + p), (E = (l ? a : i) + c));
        let x = w - E,
          S = w + y;
        l || ((x = Math.max(x, 0)), (S = Math.min(S, h.length - 1)));
        let T = (s.slidesGrid[x] || 0) - (s.slidesGrid[0] || 0);
        function M() {
          s.updateSlides(), s.updateProgress(), s.updateSlidesClasses(), n("virtualUpdate");
        }
        if ((l && w >= E ? ((x -= E), r || (T += s.slidesGrid[0])) : l && w < E && ((x = -E), r && (T += s.slidesGrid[0])), Object.assign(s.virtual, { from: x, to: S, offset: T, slidesGrid: s.slidesGrid, slidesBefore: E, slidesAfter: y }), u === x && m === S && !e))
          return (
            s.slidesGrid !== g &&
              T !== v &&
              s.slides.forEach((e) => {
                e.style[b] = T - Math.abs(s.cssOverflowAdjustment()) + "px";
              }),
            s.updateProgress(),
            void n("virtualUpdate")
          );
        if (s.params.virtual.renderExternal)
          return (
            s.params.virtual.renderExternal.call(s, {
              offset: T,
              from: x,
              to: S,
              slides: (function () {
                const e = [];
                for (let t = x; t <= S; t += 1) e.push(h[t]);
                return e;
              })(),
            }),
            void (s.params.virtual.renderExternalUpdate ? M() : n("virtualUpdate"))
          );
        const C = [],
          P = [],
          L = (e) => {
            let t = e;
            return e < 0 ? (t = h.length + e) : t >= h.length && (t -= h.length), t;
          };
        if (e)
          s.slides
            .filter((e) => e.matches(`.${s.params.slideClass}, swiper-slide`))
            .forEach((e) => {
              e.remove();
            });
        else
          for (let e = u; e <= m; e += 1)
            if (e < x || e > S) {
              const t = L(e);
              s.slides
                .filter((e) => e.matches(`.${s.params.slideClass}[data-swiper-slide-index="${t}"], swiper-slide[data-swiper-slide-index="${t}"]`))
                .forEach((e) => {
                  e.remove();
                });
            }
        const I = l ? -h.length : 0,
          A = l ? 2 * h.length : h.length;
        for (let t = I; t < A; t += 1)
          if (t >= x && t <= S) {
            const s = L(t);
            void 0 === m || e ? P.push(s) : (t > m && P.push(s), t < u && C.push(s));
          }
        if (
          (P.forEach((e) => {
            s.slidesEl.append(d(h[e], e));
          }),
          l)
        )
          for (let e = C.length - 1; e >= 0; e -= 1) {
            const t = C[e];
            s.slidesEl.prepend(d(h[t], t));
          }
        else
          C.sort((e, t) => t - e),
            C.forEach((e) => {
              s.slidesEl.prepend(d(h[e], e));
            });
        f(s.slidesEl, ".swiper-slide, swiper-slide").forEach((e) => {
          e.style[b] = T - Math.abs(s.cssOverflowAdjustment()) + "px";
        }),
          M();
      }
      r("beforeInit", () => {
        if (!s.params.virtual.enabled) return;
        let e;
        if (void 0 === s.passedParams.virtual.slides) {
          const t = [...s.slidesEl.children].filter((e) => e.matches(`.${s.params.slideClass}, swiper-slide`));
          t &&
            t.length &&
            ((s.virtual.slides = [...t]),
            (e = !0),
            t.forEach((e, t) => {
              e.setAttribute("data-swiper-slide-index", t), (s.virtual.cache[t] = e), e.remove();
            }));
        }
        e || (s.virtual.slides = s.params.virtual.slides), s.classNames.push(`${s.params.containerModifierClass}virtual`), (s.params.watchSlidesProgress = !0), (s.originalParams.watchSlidesProgress = !0), c(!1, !0);
      }),
        r("setTranslate", () => {
          s.params.virtual.enabled &&
            (s.params.cssMode && !s._immediateVirtual
              ? (clearTimeout(t),
                (t = setTimeout(() => {
                  c();
                }, 100)))
              : c());
        }),
        r("init update resize", () => {
          s.params.virtual.enabled && s.params.cssMode && u(s.wrapperEl, "--swiper-virtual-size", `${s.virtualSize}px`);
        }),
        Object.assign(s.virtual, {
          appendSlide: function (e) {
            if ("object" == typeof e && "length" in e) for (let t = 0; t < e.length; t += 1) e[t] && s.virtual.slides.push(e[t]);
            else s.virtual.slides.push(e);
            c(!0);
          },
          prependSlide: function (e) {
            const t = s.activeIndex;
            let a = t + 1,
              i = 1;
            if (Array.isArray(e)) {
              for (let t = 0; t < e.length; t += 1) e[t] && s.virtual.slides.unshift(e[t]);
              (a = t + e.length), (i = e.length);
            } else s.virtual.slides.unshift(e);
            if (s.params.virtual.cache) {
              const e = s.virtual.cache,
                t = {};
              Object.keys(e).forEach((s) => {
                const a = e[s],
                  r = a.getAttribute("data-swiper-slide-index");
                r && a.setAttribute("data-swiper-slide-index", parseInt(r, 10) + i), (t[parseInt(s, 10) + i] = a);
              }),
                (s.virtual.cache = t);
            }
            c(!0), s.slideTo(a, 0);
          },
          removeSlide: function (e) {
            if (null == e) return;
            let t = s.activeIndex;
            if (Array.isArray(e))
              for (let a = e.length - 1; a >= 0; a -= 1)
                s.params.virtual.cache &&
                  (delete s.virtual.cache[e[a]],
                  Object.keys(s.virtual.cache).forEach((t) => {
                    t > e && ((s.virtual.cache[t - 1] = s.virtual.cache[t]), s.virtual.cache[t - 1].setAttribute("data-swiper-slide-index", t - 1), delete s.virtual.cache[t]);
                  })),
                  s.virtual.slides.splice(e[a], 1),
                  e[a] < t && (t -= 1),
                  (t = Math.max(t, 0));
            else
              s.params.virtual.cache &&
                (delete s.virtual.cache[e],
                Object.keys(s.virtual.cache).forEach((t) => {
                  t > e && ((s.virtual.cache[t - 1] = s.virtual.cache[t]), s.virtual.cache[t - 1].setAttribute("data-swiper-slide-index", t - 1), delete s.virtual.cache[t]);
                })),
                s.virtual.slides.splice(e, 1),
                e < t && (t -= 1),
                (t = Math.max(t, 0));
            c(!0), s.slideTo(t, 0);
          },
          removeAllSlides: function () {
            (s.virtual.slides = []), s.params.virtual.cache && (s.virtual.cache = {}), c(!0), s.slideTo(0, 0);
          },
          update: c,
        });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: i, emit: n } = e;
      const l = a(),
        o = r();
      function d(e) {
        if (!t.enabled) return;
        const { rtlTranslate: s } = t;
        let a = e;
        a.originalEvent && (a = a.originalEvent);
        const i = a.keyCode || a.charCode,
          r = t.params.keyboard.pageUpDown,
          d = r && 33 === i,
          c = r && 34 === i,
          p = 37 === i,
          u = 39 === i,
          m = 38 === i,
          h = 40 === i;
        if (!t.allowSlideNext && ((t.isHorizontal() && u) || (t.isVertical() && h) || c)) return !1;
        if (!t.allowSlidePrev && ((t.isHorizontal() && p) || (t.isVertical() && m) || d)) return !1;
        if (!(a.shiftKey || a.altKey || a.ctrlKey || a.metaKey || (l.activeElement && l.activeElement.nodeName && ("input" === l.activeElement.nodeName.toLowerCase() || "textarea" === l.activeElement.nodeName.toLowerCase())))) {
          if (t.params.keyboard.onlyInViewport && (d || c || p || u || m || h)) {
            let e = !1;
            if (E(t.el, `.${t.params.slideClass}, swiper-slide`).length > 0 && 0 === E(t.el, `.${t.params.slideActiveClass}`).length) return;
            const a = t.el,
              i = a.clientWidth,
              r = a.clientHeight,
              n = o.innerWidth,
              l = o.innerHeight,
              d = w(a);
            s && (d.left -= a.scrollLeft);
            const c = [
              [d.left, d.top],
              [d.left + i, d.top],
              [d.left, d.top + r],
              [d.left + i, d.top + r],
            ];
            for (let t = 0; t < c.length; t += 1) {
              const s = c[t];
              if (s[0] >= 0 && s[0] <= n && s[1] >= 0 && s[1] <= l) {
                if (0 === s[0] && 0 === s[1]) continue;
                e = !0;
              }
            }
            if (!e) return;
          }
          t.isHorizontal() ? ((d || c || p || u) && (a.preventDefault ? a.preventDefault() : (a.returnValue = !1)), (((c || u) && !s) || ((d || p) && s)) && t.slideNext(), (((d || p) && !s) || ((c || u) && s)) && t.slidePrev()) : ((d || c || m || h) && (a.preventDefault ? a.preventDefault() : (a.returnValue = !1)), (c || h) && t.slideNext(), (d || m) && t.slidePrev()), n("keyPress", i);
        }
      }
      function c() {
        t.keyboard.enabled || (l.addEventListener("keydown", d), (t.keyboard.enabled = !0));
      }
      function p() {
        t.keyboard.enabled && (l.removeEventListener("keydown", d), (t.keyboard.enabled = !1));
      }
      (t.keyboard = { enabled: !1 }),
        s({ keyboard: { enabled: !1, onlyInViewport: !0, pageUpDown: !0 } }),
        i("init", () => {
          t.params.keyboard.enabled && c();
        }),
        i("destroy", () => {
          t.keyboard.enabled && p();
        }),
        Object.assign(t.keyboard, { enable: c, disable: p });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a, emit: i } = e;
      const n = r();
      let d;
      s({ mousewheel: { enabled: !1, releaseOnEdges: !1, invert: !1, forceToAxis: !1, sensitivity: 1, eventsTarget: "container", thresholdDelta: null, thresholdTime: null, noMousewheelClass: "swiper-no-mousewheel" } }), (t.mousewheel = { enabled: !1 });
      let c,
        p = o();
      const u = [];
      function m() {
        t.enabled && (t.mouseEntered = !0);
      }
      function h() {
        t.enabled && (t.mouseEntered = !1);
      }
      function f(e) {
        return !(t.params.mousewheel.thresholdDelta && e.delta < t.params.mousewheel.thresholdDelta) && !(t.params.mousewheel.thresholdTime && o() - p < t.params.mousewheel.thresholdTime) && ((e.delta >= 6 && o() - p < 60) || (e.direction < 0 ? (t.isEnd && !t.params.loop) || t.animating || (t.slideNext(), i("scroll", e.raw)) : (t.isBeginning && !t.params.loop) || t.animating || (t.slidePrev(), i("scroll", e.raw)), (p = new n.Date().getTime()), !1));
      }
      function g(e) {
        let s = e,
          a = !0;
        if (!t.enabled) return;
        if (e.target.closest(`.${t.params.mousewheel.noMousewheelClass}`)) return;
        const r = t.params.mousewheel;
        t.params.cssMode && s.preventDefault();
        let n = t.el;
        "container" !== t.params.mousewheel.eventsTarget && (n = document.querySelector(t.params.mousewheel.eventsTarget));
        const p = n && n.contains(s.target);
        if (!t.mouseEntered && !p && !r.releaseOnEdges) return !0;
        s.originalEvent && (s = s.originalEvent);
        let m = 0;
        const h = t.rtlTranslate ? -1 : 1,
          g = (function (e) {
            let t = 0,
              s = 0,
              a = 0,
              i = 0;
            return "detail" in e && (s = e.detail), "wheelDelta" in e && (s = -e.wheelDelta / 120), "wheelDeltaY" in e && (s = -e.wheelDeltaY / 120), "wheelDeltaX" in e && (t = -e.wheelDeltaX / 120), "axis" in e && e.axis === e.HORIZONTAL_AXIS && ((t = s), (s = 0)), (a = 10 * t), (i = 10 * s), "deltaY" in e && (i = e.deltaY), "deltaX" in e && (a = e.deltaX), e.shiftKey && !a && ((a = i), (i = 0)), (a || i) && e.deltaMode && (1 === e.deltaMode ? ((a *= 40), (i *= 40)) : ((a *= 800), (i *= 800))), a && !t && (t = a < 1 ? -1 : 1), i && !s && (s = i < 1 ? -1 : 1), { spinX: t, spinY: s, pixelX: a, pixelY: i };
          })(s);
        if (r.forceToAxis)
          if (t.isHorizontal()) {
            if (!(Math.abs(g.pixelX) > Math.abs(g.pixelY))) return !0;
            m = -g.pixelX * h;
          } else {
            if (!(Math.abs(g.pixelY) > Math.abs(g.pixelX))) return !0;
            m = -g.pixelY;
          }
        else m = Math.abs(g.pixelX) > Math.abs(g.pixelY) ? -g.pixelX * h : -g.pixelY;
        if (0 === m) return !0;
        r.invert && (m = -m);
        let v = t.getTranslate() + m * r.sensitivity;
        if ((v >= t.minTranslate() && (v = t.minTranslate()), v <= t.maxTranslate() && (v = t.maxTranslate()), (a = !!t.params.loop || !(v === t.minTranslate() || v === t.maxTranslate())), a && t.params.nested && s.stopPropagation(), t.params.freeMode && t.params.freeMode.enabled)) {
          const e = { time: o(), delta: Math.abs(m), direction: Math.sign(m) },
            a = c && e.time < c.time + 500 && e.delta <= c.delta && e.direction === c.direction;
          if (!a) {
            c = void 0;
            let n = t.getTranslate() + m * r.sensitivity;
            const o = t.isBeginning,
              p = t.isEnd;
            if ((n >= t.minTranslate() && (n = t.minTranslate()), n <= t.maxTranslate() && (n = t.maxTranslate()), t.setTransition(0), t.setTranslate(n), t.updateProgress(), t.updateActiveIndex(), t.updateSlidesClasses(), ((!o && t.isBeginning) || (!p && t.isEnd)) && t.updateSlidesClasses(), t.params.loop && t.loopFix({ direction: e.direction < 0 ? "next" : "prev", byMousewheel: !0 }), t.params.freeMode.sticky)) {
              clearTimeout(d), (d = void 0), u.length >= 15 && u.shift();
              const s = u.length ? u[u.length - 1] : void 0,
                a = u[0];
              if ((u.push(e), s && (e.delta > s.delta || e.direction !== s.direction))) u.splice(0);
              else if (u.length >= 15 && e.time - a.time < 500 && a.delta - e.delta >= 1 && e.delta <= 6) {
                const s = m > 0 ? 0.8 : 0.2;
                (c = e),
                  u.splice(0),
                  (d = l(() => {
                    t.slideToClosest(t.params.speed, !0, void 0, s);
                  }, 0));
              }
              d ||
                (d = l(() => {
                  (c = e), u.splice(0), t.slideToClosest(t.params.speed, !0, void 0, 0.5);
                }, 500));
            }
            if ((a || i("scroll", s), t.params.autoplay && t.params.autoplayDisableOnInteraction && t.autoplay.stop(), r.releaseOnEdges && (n === t.minTranslate() || n === t.maxTranslate()))) return !0;
          }
        } else {
          const s = { time: o(), delta: Math.abs(m), direction: Math.sign(m), raw: e };
          u.length >= 2 && u.shift();
          const a = u.length ? u[u.length - 1] : void 0;
          if (
            (u.push(s),
            a ? (s.direction !== a.direction || s.delta > a.delta || s.time > a.time + 150) && f(s) : f(s),
            (function (e) {
              const s = t.params.mousewheel;
              if (e.direction < 0) {
                if (t.isEnd && !t.params.loop && s.releaseOnEdges) return !0;
              } else if (t.isBeginning && !t.params.loop && s.releaseOnEdges) return !0;
              return !1;
            })(s))
          )
            return !0;
        }
        return s.preventDefault ? s.preventDefault() : (s.returnValue = !1), !1;
      }
      function v(e) {
        let s = t.el;
        "container" !== t.params.mousewheel.eventsTarget && (s = document.querySelector(t.params.mousewheel.eventsTarget)), s[e]("mouseenter", m), s[e]("mouseleave", h), s[e]("wheel", g);
      }
      function w() {
        return t.params.cssMode ? (t.wrapperEl.removeEventListener("wheel", g), !0) : !t.mousewheel.enabled && (v("addEventListener"), (t.mousewheel.enabled = !0), !0);
      }
      function b() {
        return t.params.cssMode ? (t.wrapperEl.addEventListener(event, g), !0) : !!t.mousewheel.enabled && (v("removeEventListener"), (t.mousewheel.enabled = !1), !0);
      }
      a("init", () => {
        !t.params.mousewheel.enabled && t.params.cssMode && b(), t.params.mousewheel.enabled && w();
      }),
        a("destroy", () => {
          t.params.cssMode && w(), t.mousewheel.enabled && b();
        }),
        Object.assign(t.mousewheel, { enable: w, disable: b });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a, emit: i } = e;
      function r(e) {
        let s;
        return e && "string" == typeof e && t.isElement && ((s = t.el.querySelector(e)), s) ? s : (e && ("string" == typeof e && (s = [...document.querySelectorAll(e)]), t.params.uniqueNavElements && "string" == typeof e && s && s.length > 1 && 1 === t.el.querySelectorAll(e).length ? (s = t.el.querySelector(e)) : s && 1 === s.length && (s = s[0])), e && !s ? e : s);
      }
      function n(e, s) {
        const a = t.params.navigation;
        (e = T(e)).forEach((e) => {
          e && (e.classList[s ? "add" : "remove"](...a.disabledClass.split(" ")), "BUTTON" === e.tagName && (e.disabled = s), t.params.watchOverflow && t.enabled && e.classList[t.isLocked ? "add" : "remove"](a.lockClass));
        });
      }
      function l() {
        const { nextEl: e, prevEl: s } = t.navigation;
        if (t.params.loop) return n(s, !1), void n(e, !1);
        n(s, t.isBeginning && !t.params.rewind), n(e, t.isEnd && !t.params.rewind);
      }
      function o(e) {
        e.preventDefault(), (!t.isBeginning || t.params.loop || t.params.rewind) && (t.slidePrev(), i("navigationPrev"));
      }
      function d(e) {
        e.preventDefault(), (!t.isEnd || t.params.loop || t.params.rewind) && (t.slideNext(), i("navigationNext"));
      }
      function c() {
        const e = t.params.navigation;
        if (((t.params.navigation = ie(t, t.originalParams.navigation, t.params.navigation, { nextEl: "swiper-button-next", prevEl: "swiper-button-prev" })), !e.nextEl && !e.prevEl)) return;
        let s = r(e.nextEl),
          a = r(e.prevEl);
        Object.assign(t.navigation, { nextEl: s, prevEl: a }), (s = T(s)), (a = T(a));
        const i = (s, a) => {
          s && s.addEventListener("click", "next" === a ? d : o), !t.enabled && s && s.classList.add(...e.lockClass.split(" "));
        };
        s.forEach((e) => i(e, "next")), a.forEach((e) => i(e, "prev"));
      }
      function p() {
        let { nextEl: e, prevEl: s } = t.navigation;
        (e = T(e)), (s = T(s));
        const a = (e, s) => {
          e.removeEventListener("click", "next" === s ? d : o), e.classList.remove(...t.params.navigation.disabledClass.split(" "));
        };
        e.forEach((e) => a(e, "next")), s.forEach((e) => a(e, "prev"));
      }
      s({ navigation: { nextEl: null, prevEl: null, hideOnClick: !1, disabledClass: "swiper-button-disabled", hiddenClass: "swiper-button-hidden", lockClass: "swiper-button-lock", navigationDisabledClass: "swiper-navigation-disabled" } }),
        (t.navigation = { nextEl: null, prevEl: null }),
        a("init", () => {
          !1 === t.params.navigation.enabled ? u() : (c(), l());
        }),
        a("toEdge fromEdge lock unlock", () => {
          l();
        }),
        a("destroy", () => {
          p();
        }),
        a("enable disable", () => {
          let { nextEl: e, prevEl: s } = t.navigation;
          (e = T(e)), (s = T(s)), t.enabled ? l() : [...e, ...s].filter((e) => !!e).forEach((e) => e.classList.add(t.params.navigation.lockClass));
        }),
        a("click", (e, s) => {
          let { nextEl: a, prevEl: r } = t.navigation;
          (a = T(a)), (r = T(r));
          const n = s.target;
          let l = r.includes(n) || a.includes(n);
          if (t.isElement && !l) {
            const e = s.path || (s.composedPath && s.composedPath());
            e && (l = e.find((e) => a.includes(e) || r.includes(e)));
          }
          if (t.params.navigation.hideOnClick && !l) {
            if (t.pagination && t.params.pagination && t.params.pagination.clickable && (t.pagination.el === n || t.pagination.el.contains(n))) return;
            let e;
            a.length ? (e = a[0].classList.contains(t.params.navigation.hiddenClass)) : r.length && (e = r[0].classList.contains(t.params.navigation.hiddenClass)), i(!0 === e ? "navigationShow" : "navigationHide"), [...a, ...r].filter((e) => !!e).forEach((e) => e.classList.toggle(t.params.navigation.hiddenClass));
          }
        });
      const u = () => {
        t.el.classList.add(...t.params.navigation.navigationDisabledClass.split(" ")), p();
      };
      Object.assign(t.navigation, {
        enable: () => {
          t.el.classList.remove(...t.params.navigation.navigationDisabledClass.split(" ")), c(), l();
        },
        disable: u,
        update: l,
        init: c,
        destroy: p,
      });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a, emit: i } = e;
      const r = "swiper-pagination";
      let n;
      s({ pagination: { el: null, bulletElement: "span", clickable: !1, hideOnClick: !1, renderBullet: null, renderProgressbar: null, renderFraction: null, renderCustom: null, progressbarOpposite: !1, type: "bullets", dynamicBullets: !1, dynamicMainBullets: 1, formatFractionCurrent: (e) => e, formatFractionTotal: (e) => e, bulletClass: `${r}-bullet`, bulletActiveClass: `${r}-bullet-active`, modifierClass: `${r}-`, currentClass: `${r}-current`, totalClass: `${r}-total`, hiddenClass: `${r}-hidden`, progressbarFillClass: `${r}-progressbar-fill`, progressbarOppositeClass: `${r}-progressbar-opposite`, clickableClass: `${r}-clickable`, lockClass: `${r}-lock`, horizontalClass: `${r}-horizontal`, verticalClass: `${r}-vertical`, paginationDisabledClass: `${r}-disabled` } }), (t.pagination = { el: null, bullets: [] });
      let l = 0;
      function o() {
        return !t.params.pagination.el || !t.pagination.el || (Array.isArray(t.pagination.el) && 0 === t.pagination.el.length);
      }
      function d(e, s) {
        const { bulletActiveClass: a } = t.params.pagination;
        e && (e = e[("prev" === s ? "previous" : "next") + "ElementSibling"]) && (e.classList.add(`${a}-${s}`), (e = e[("prev" === s ? "previous" : "next") + "ElementSibling"]) && e.classList.add(`${a}-${s}-${s}`));
      }
      function c(e) {
        const s = e.target.closest(re(t.params.pagination.bulletClass));
        if (!s) return;
        e.preventDefault();
        const a = y(s) * t.params.slidesPerGroup;
        if (t.params.loop) {
          if (t.realIndex === a) return;
          t.slideToLoop(a);
        } else t.slideTo(a);
      }
      function p() {
        const e = t.rtl,
          s = t.params.pagination;
        if (o()) return;
        let a,
          r,
          c = t.pagination.el;
        c = T(c);
        const p = t.virtual && t.params.virtual.enabled ? t.virtual.slides.length : t.slides.length,
          u = t.params.loop ? Math.ceil(p / t.params.slidesPerGroup) : t.snapGrid.length;
        if ((t.params.loop ? ((r = t.previousRealIndex || 0), (a = t.params.slidesPerGroup > 1 ? Math.floor(t.realIndex / t.params.slidesPerGroup) : t.realIndex)) : void 0 !== t.snapIndex ? ((a = t.snapIndex), (r = t.previousSnapIndex)) : ((r = t.previousIndex || 0), (a = t.activeIndex || 0)), "bullets" === s.type && t.pagination.bullets && t.pagination.bullets.length > 0)) {
          const i = t.pagination.bullets;
          let o, p, u;
          if (
            (s.dynamicBullets &&
              ((n = S(i[0], t.isHorizontal() ? "width" : "height", !0)),
              c.forEach((e) => {
                e.style[t.isHorizontal() ? "width" : "height"] = n * (s.dynamicMainBullets + 4) + "px";
              }),
              s.dynamicMainBullets > 1 && void 0 !== r && ((l += a - (r || 0)), l > s.dynamicMainBullets - 1 ? (l = s.dynamicMainBullets - 1) : l < 0 && (l = 0)),
              (o = Math.max(a - l, 0)),
              (p = o + (Math.min(i.length, s.dynamicMainBullets) - 1)),
              (u = (p + o) / 2)),
            i.forEach((e) => {
              const t = [...["", "-next", "-next-next", "-prev", "-prev-prev", "-main"].map((e) => `${s.bulletActiveClass}${e}`)].map((e) => ("string" == typeof e && e.includes(" ") ? e.split(" ") : e)).flat();
              e.classList.remove(...t);
            }),
            c.length > 1)
          )
            i.forEach((e) => {
              const i = y(e);
              i === a ? e.classList.add(...s.bulletActiveClass.split(" ")) : t.isElement && e.setAttribute("part", "bullet"), s.dynamicBullets && (i >= o && i <= p && e.classList.add(...`${s.bulletActiveClass}-main`.split(" ")), i === o && d(e, "prev"), i === p && d(e, "next"));
            });
          else {
            const e = i[a];
            if (
              (e && e.classList.add(...s.bulletActiveClass.split(" ")),
              t.isElement &&
                i.forEach((e, t) => {
                  e.setAttribute("part", t === a ? "bullet-active" : "bullet");
                }),
              s.dynamicBullets)
            ) {
              const e = i[o],
                t = i[p];
              for (let e = o; e <= p; e += 1) i[e] && i[e].classList.add(...`${s.bulletActiveClass}-main`.split(" "));
              d(e, "prev"), d(t, "next");
            }
          }
          if (s.dynamicBullets) {
            const a = Math.min(i.length, s.dynamicMainBullets + 4),
              r = (n * a - n) / 2 - u * n,
              l = e ? "right" : "left";
            i.forEach((e) => {
              e.style[t.isHorizontal() ? l : "top"] = `${r}px`;
            });
          }
        }
        c.forEach((e, r) => {
          if (
            ("fraction" === s.type &&
              (e.querySelectorAll(re(s.currentClass)).forEach((e) => {
                e.textContent = s.formatFractionCurrent(a + 1);
              }),
              e.querySelectorAll(re(s.totalClass)).forEach((e) => {
                e.textContent = s.formatFractionTotal(u);
              })),
            "progressbar" === s.type)
          ) {
            let i;
            i = s.progressbarOpposite ? (t.isHorizontal() ? "vertical" : "horizontal") : t.isHorizontal() ? "horizontal" : "vertical";
            const r = (a + 1) / u;
            let n = 1,
              l = 1;
            "horizontal" === i ? (n = r) : (l = r),
              e.querySelectorAll(re(s.progressbarFillClass)).forEach((e) => {
                (e.style.transform = `translate3d(0,0,0) scaleX(${n}) scaleY(${l})`), (e.style.transitionDuration = `${t.params.speed}ms`);
              });
          }
          "custom" === s.type && s.renderCustom ? ((e.innerHTML = s.renderCustom(t, a + 1, u)), 0 === r && i("paginationRender", e)) : (0 === r && i("paginationRender", e), i("paginationUpdate", e)), t.params.watchOverflow && t.enabled && e.classList[t.isLocked ? "add" : "remove"](s.lockClass);
        });
      }
      function u() {
        const e = t.params.pagination;
        if (o()) return;
        const s = t.virtual && t.params.virtual.enabled ? t.virtual.slides.length : t.grid && t.params.grid.rows > 1 ? t.slides.length / Math.ceil(t.params.grid.rows) : t.slides.length;
        let a = t.pagination.el;
        a = T(a);
        let r = "";
        if ("bullets" === e.type) {
          let a = t.params.loop ? Math.ceil(s / t.params.slidesPerGroup) : t.snapGrid.length;
          t.params.freeMode && t.params.freeMode.enabled && a > s && (a = s);
          for (let s = 0; s < a; s += 1) e.renderBullet ? (r += e.renderBullet.call(t, s, e.bulletClass)) : (r += `<${e.bulletElement} ${t.isElement ? 'part="bullet"' : ""} class="${e.bulletClass}"></${e.bulletElement}>`);
        }
        "fraction" === e.type && (r = e.renderFraction ? e.renderFraction.call(t, e.currentClass, e.totalClass) : `<span class="${e.currentClass}"></span> / <span class="${e.totalClass}"></span>`),
          "progressbar" === e.type && (r = e.renderProgressbar ? e.renderProgressbar.call(t, e.progressbarFillClass) : `<span class="${e.progressbarFillClass}"></span>`),
          (t.pagination.bullets = []),
          a.forEach((s) => {
            "custom" !== e.type && (s.innerHTML = r || ""), "bullets" === e.type && t.pagination.bullets.push(...s.querySelectorAll(re(e.bulletClass)));
          }),
          "custom" !== e.type && i("paginationRender", a[0]);
      }
      function m() {
        t.params.pagination = ie(t, t.originalParams.pagination, t.params.pagination, { el: "swiper-pagination" });
        const e = t.params.pagination;
        if (!e.el) return;
        let s;
        "string" == typeof e.el && t.isElement && (s = t.el.querySelector(e.el)),
          s || "string" != typeof e.el || (s = [...document.querySelectorAll(e.el)]),
          s || (s = e.el),
          s &&
            0 !== s.length &&
            (t.params.uniqueNavElements && "string" == typeof e.el && Array.isArray(s) && s.length > 1 && ((s = [...t.el.querySelectorAll(e.el)]), s.length > 1 && (s = s.filter((e) => E(e, ".swiper")[0] === t.el)[0])),
            Array.isArray(s) && 1 === s.length && (s = s[0]),
            Object.assign(t.pagination, { el: s }),
            (s = T(s)),
            s.forEach((s) => {
              "bullets" === e.type && e.clickable && s.classList.add(...(e.clickableClass || "").split(" ")), s.classList.add(e.modifierClass + e.type), s.classList.add(t.isHorizontal() ? e.horizontalClass : e.verticalClass), "bullets" === e.type && e.dynamicBullets && (s.classList.add(`${e.modifierClass}${e.type}-dynamic`), (l = 0), e.dynamicMainBullets < 1 && (e.dynamicMainBullets = 1)), "progressbar" === e.type && e.progressbarOpposite && s.classList.add(e.progressbarOppositeClass), e.clickable && s.addEventListener("click", c), t.enabled || s.classList.add(e.lockClass);
            }));
      }
      function h() {
        const e = t.params.pagination;
        if (o()) return;
        let s = t.pagination.el;
        s &&
          ((s = T(s)),
          s.forEach((s) => {
            s.classList.remove(e.hiddenClass), s.classList.remove(e.modifierClass + e.type), s.classList.remove(t.isHorizontal() ? e.horizontalClass : e.verticalClass), e.clickable && (s.classList.remove(...(e.clickableClass || "").split(" ")), s.removeEventListener("click", c));
          })),
          t.pagination.bullets && t.pagination.bullets.forEach((t) => t.classList.remove(...e.bulletActiveClass.split(" ")));
      }
      a("changeDirection", () => {
        if (!t.pagination || !t.pagination.el) return;
        const e = t.params.pagination;
        let { el: s } = t.pagination;
        (s = T(s)),
          s.forEach((s) => {
            s.classList.remove(e.horizontalClass, e.verticalClass), s.classList.add(t.isHorizontal() ? e.horizontalClass : e.verticalClass);
          });
      }),
        a("init", () => {
          !1 === t.params.pagination.enabled ? f() : (m(), u(), p());
        }),
        a("activeIndexChange", () => {
          void 0 === t.snapIndex && p();
        }),
        a("snapIndexChange", () => {
          p();
        }),
        a("snapGridLengthChange", () => {
          u(), p();
        }),
        a("destroy", () => {
          h();
        }),
        a("enable disable", () => {
          let { el: e } = t.pagination;
          e && ((e = T(e)), e.forEach((e) => e.classList[t.enabled ? "remove" : "add"](t.params.pagination.lockClass)));
        }),
        a("lock unlock", () => {
          p();
        }),
        a("click", (e, s) => {
          const a = s.target,
            r = T(t.pagination.el);
          if (t.params.pagination.el && t.params.pagination.hideOnClick && r && r.length > 0 && !a.classList.contains(t.params.pagination.bulletClass)) {
            if (t.navigation && ((t.navigation.nextEl && a === t.navigation.nextEl) || (t.navigation.prevEl && a === t.navigation.prevEl))) return;
            const e = r[0].classList.contains(t.params.pagination.hiddenClass);
            i(!0 === e ? "paginationShow" : "paginationHide"), r.forEach((e) => e.classList.toggle(t.params.pagination.hiddenClass));
          }
        });
      const f = () => {
        t.el.classList.add(t.params.pagination.paginationDisabledClass);
        let { el: e } = t.pagination;
        e && ((e = T(e)), e.forEach((e) => e.classList.add(t.params.pagination.paginationDisabledClass))), h();
      };
      Object.assign(t.pagination, {
        enable: () => {
          t.el.classList.remove(t.params.pagination.paginationDisabledClass);
          let { el: e } = t.pagination;
          e && ((e = T(e)), e.forEach((e) => e.classList.remove(t.params.pagination.paginationDisabledClass))), m(), u(), p();
        },
        disable: f,
        render: u,
        update: p,
        init: m,
        destroy: h,
      });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: i, emit: r } = e;
      const o = a();
      let d,
        c,
        p,
        u,
        m = !1,
        h = null,
        f = null;
      function g() {
        if (!t.params.scrollbar.el || !t.scrollbar.el) return;
        const { scrollbar: e, rtlTranslate: s } = t,
          { dragEl: a, el: i } = e,
          r = t.params.scrollbar,
          n = t.params.loop ? t.progressLoop : t.progress;
        let l = c,
          o = (p - c) * n;
        s ? ((o = -o), o > 0 ? ((l = c - o), (o = 0)) : -o + c > p && (l = p + o)) : o < 0 ? ((l = c + o), (o = 0)) : o + c > p && (l = p - o),
          t.isHorizontal() ? ((a.style.transform = `translate3d(${o}px, 0, 0)`), (a.style.width = `${l}px`)) : ((a.style.transform = `translate3d(0px, ${o}px, 0)`), (a.style.height = `${l}px`)),
          r.hide &&
            (clearTimeout(h),
            (i.style.opacity = 1),
            (h = setTimeout(() => {
              (i.style.opacity = 0), (i.style.transitionDuration = "400ms");
            }, 1e3)));
      }
      function b() {
        if (!t.params.scrollbar.el || !t.scrollbar.el) return;
        const { scrollbar: e } = t,
          { dragEl: s, el: a } = e;
        (s.style.width = ""), (s.style.height = ""), (p = t.isHorizontal() ? a.offsetWidth : a.offsetHeight), (u = t.size / (t.virtualSize + t.params.slidesOffsetBefore - (t.params.centeredSlides ? t.snapGrid[0] : 0))), (c = "auto" === t.params.scrollbar.dragSize ? p * u : parseInt(t.params.scrollbar.dragSize, 10)), t.isHorizontal() ? (s.style.width = `${c}px`) : (s.style.height = `${c}px`), (a.style.display = u >= 1 ? "none" : ""), t.params.scrollbar.hide && (a.style.opacity = 0), t.params.watchOverflow && t.enabled && e.el.classList[t.isLocked ? "add" : "remove"](t.params.scrollbar.lockClass);
      }
      function y(e) {
        return t.isHorizontal() ? e.clientX : e.clientY;
      }
      function E(e) {
        const { scrollbar: s, rtlTranslate: a } = t,
          { el: i } = s;
        let r;
        (r = (y(e) - w(i)[t.isHorizontal() ? "left" : "top"] - (null !== d ? d : c / 2)) / (p - c)), (r = Math.max(Math.min(r, 1), 0)), a && (r = 1 - r);
        const n = t.minTranslate() + (t.maxTranslate() - t.minTranslate()) * r;
        t.updateProgress(n), t.setTranslate(n), t.updateActiveIndex(), t.updateSlidesClasses();
      }
      function x(e) {
        const s = t.params.scrollbar,
          { scrollbar: a, wrapperEl: i } = t,
          { el: n, dragEl: l } = a;
        (m = !0), (d = e.target === l ? y(e) - e.target.getBoundingClientRect()[t.isHorizontal() ? "left" : "top"] : null), e.preventDefault(), e.stopPropagation(), (i.style.transitionDuration = "100ms"), (l.style.transitionDuration = "100ms"), E(e), clearTimeout(f), (n.style.transitionDuration = "0ms"), s.hide && (n.style.opacity = 1), t.params.cssMode && (t.wrapperEl.style["scroll-snap-type"] = "none"), r("scrollbarDragStart", e);
      }
      function S(e) {
        const { scrollbar: s, wrapperEl: a } = t,
          { el: i, dragEl: n } = s;
        m && (e.preventDefault && e.cancelable ? e.preventDefault() : (e.returnValue = !1), E(e), (a.style.transitionDuration = "0ms"), (i.style.transitionDuration = "0ms"), (n.style.transitionDuration = "0ms"), r("scrollbarDragMove", e));
      }
      function M(e) {
        const s = t.params.scrollbar,
          { scrollbar: a, wrapperEl: i } = t,
          { el: n } = a;
        m &&
          ((m = !1),
          t.params.cssMode && ((t.wrapperEl.style["scroll-snap-type"] = ""), (i.style.transitionDuration = "")),
          s.hide &&
            (clearTimeout(f),
            (f = l(() => {
              (n.style.opacity = 0), (n.style.transitionDuration = "400ms");
            }, 1e3))),
          r("scrollbarDragEnd", e),
          s.snapOnRelease && t.slideToClosest());
      }
      function C(e) {
        const { scrollbar: s, params: a } = t,
          i = s.el;
        if (!i) return;
        const r = i,
          n = !!a.passiveListeners && { passive: !1, capture: !1 },
          l = !!a.passiveListeners && { passive: !0, capture: !1 };
        if (!r) return;
        const d = "on" === e ? "addEventListener" : "removeEventListener";
        r[d]("pointerdown", x, n), o[d]("pointermove", S, n), o[d]("pointerup", M, l);
      }
      function P() {
        const { scrollbar: e, el: s } = t;
        t.params.scrollbar = ie(t, t.originalParams.scrollbar, t.params.scrollbar, { el: "swiper-scrollbar" });
        const a = t.params.scrollbar;
        if (!a.el) return;
        let i, r;
        if (("string" == typeof a.el && t.isElement && (i = t.el.querySelector(a.el)), i || "string" != typeof a.el)) i || (i = a.el);
        else if (((i = o.querySelectorAll(a.el)), !i.length)) return;
        t.params.uniqueNavElements && "string" == typeof a.el && i.length > 1 && 1 === s.querySelectorAll(a.el).length && (i = s.querySelector(a.el)), i.length > 0 && (i = i[0]), i.classList.add(t.isHorizontal() ? a.horizontalClass : a.verticalClass), i && ((r = i.querySelector(re(t.params.scrollbar.dragClass))), r || ((r = v("div", t.params.scrollbar.dragClass)), i.append(r))), Object.assign(e, { el: i, dragEl: r }), a.draggable && t.params.scrollbar.el && t.scrollbar.el && C("on"), i && i.classList[t.enabled ? "remove" : "add"](...n(t.params.scrollbar.lockClass));
      }
      function L() {
        const e = t.params.scrollbar,
          s = t.scrollbar.el;
        s && s.classList.remove(...n(t.isHorizontal() ? e.horizontalClass : e.verticalClass)), t.params.scrollbar.el && t.scrollbar.el && C("off");
      }
      s({ scrollbar: { el: null, dragSize: "auto", hide: !1, draggable: !1, snapOnRelease: !0, lockClass: "swiper-scrollbar-lock", dragClass: "swiper-scrollbar-drag", scrollbarDisabledClass: "swiper-scrollbar-disabled", horizontalClass: "swiper-scrollbar-horizontal", verticalClass: "swiper-scrollbar-vertical" } }),
        (t.scrollbar = { el: null, dragEl: null }),
        i("changeDirection", () => {
          if (!t.scrollbar || !t.scrollbar.el) return;
          const e = t.params.scrollbar;
          let { el: s } = t.scrollbar;
          (s = T(s)),
            s.forEach((s) => {
              s.classList.remove(e.horizontalClass, e.verticalClass), s.classList.add(t.isHorizontal() ? e.horizontalClass : e.verticalClass);
            });
        }),
        i("init", () => {
          !1 === t.params.scrollbar.enabled ? I() : (P(), b(), g());
        }),
        i("update resize observerUpdate lock unlock changeDirection", () => {
          b();
        }),
        i("setTranslate", () => {
          g();
        }),
        i("setTransition", (e, s) => {
          !(function (e) {
            t.params.scrollbar.el && t.scrollbar.el && (t.scrollbar.dragEl.style.transitionDuration = `${e}ms`);
          })(s);
        }),
        i("enable disable", () => {
          const { el: e } = t.scrollbar;
          e && e.classList[t.enabled ? "remove" : "add"](...n(t.params.scrollbar.lockClass));
        }),
        i("destroy", () => {
          L();
        });
      const I = () => {
        t.el.classList.add(...n(t.params.scrollbar.scrollbarDisabledClass)), t.scrollbar.el && t.scrollbar.el.classList.add(...n(t.params.scrollbar.scrollbarDisabledClass)), L();
      };
      Object.assign(t.scrollbar, {
        enable: () => {
          t.el.classList.remove(...n(t.params.scrollbar.scrollbarDisabledClass)), t.scrollbar.el && t.scrollbar.el.classList.remove(...n(t.params.scrollbar.scrollbarDisabledClass)), P(), b(), g();
        },
        disable: I,
        updateSize: b,
        setTranslate: g,
        init: P,
        destroy: L,
      });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a } = e;
      s({ parallax: { enabled: !1 } });
      const i = "[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y], [data-swiper-parallax-opacity], [data-swiper-parallax-scale]",
        r = (e, s) => {
          const { rtl: a } = t,
            i = a ? -1 : 1,
            r = e.getAttribute("data-swiper-parallax") || "0";
          let n = e.getAttribute("data-swiper-parallax-x"),
            l = e.getAttribute("data-swiper-parallax-y");
          const o = e.getAttribute("data-swiper-parallax-scale"),
            d = e.getAttribute("data-swiper-parallax-opacity"),
            c = e.getAttribute("data-swiper-parallax-rotate");
          if ((n || l ? ((n = n || "0"), (l = l || "0")) : t.isHorizontal() ? ((n = r), (l = "0")) : ((l = r), (n = "0")), (n = n.indexOf("%") >= 0 ? parseInt(n, 10) * s * i + "%" : n * s * i + "px"), (l = l.indexOf("%") >= 0 ? parseInt(l, 10) * s + "%" : l * s + "px"), null != d)) {
            const t = d - (d - 1) * (1 - Math.abs(s));
            e.style.opacity = t;
          }
          let p = `translate3d(${n}, ${l}, 0px)`;
          if (null != o) {
            p += ` scale(${o - (o - 1) * (1 - Math.abs(s))})`;
          }
          if (c && null != c) {
            p += ` rotate(${c * s * -1}deg)`;
          }
          e.style.transform = p;
        },
        n = () => {
          const { el: e, slides: s, progress: a, snapGrid: n, isElement: l } = t,
            o = f(e, i);
          t.isElement && o.push(...f(t.hostEl, i)),
            o.forEach((e) => {
              r(e, a);
            }),
            s.forEach((e, s) => {
              let l = e.progress;
              t.params.slidesPerGroup > 1 && "auto" !== t.params.slidesPerView && (l += Math.ceil(s / 2) - a * (n.length - 1)),
                (l = Math.min(Math.max(l, -1), 1)),
                e.querySelectorAll(`${i}, [data-swiper-parallax-rotate]`).forEach((e) => {
                  r(e, l);
                });
            });
        };
      a("beforeInit", () => {
        t.params.parallax.enabled && ((t.params.watchSlidesProgress = !0), (t.originalParams.watchSlidesProgress = !0));
      }),
        a("init", () => {
          t.params.parallax.enabled && n();
        }),
        a("setTranslate", () => {
          t.params.parallax.enabled && n();
        }),
        a("setTransition", (e, s) => {
          t.params.parallax.enabled &&
            (function (e) {
              void 0 === e && (e = t.params.speed);
              const { el: s, hostEl: a } = t,
                r = [...s.querySelectorAll(i)];
              t.isElement && r.push(...a.querySelectorAll(i)),
                r.forEach((t) => {
                  let s = parseInt(t.getAttribute("data-swiper-parallax-duration"), 10) || e;
                  0 === e && (s = 0), (t.style.transitionDuration = `${s}ms`);
                });
            })(s);
        });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a, emit: i } = e;
      const n = r();
      s({ zoom: { enabled: !1, limitToOriginalSize: !1, maxRatio: 3, minRatio: 1, toggle: !0, containerClass: "swiper-zoom-container", zoomedSlideClass: "swiper-slide-zoomed" } }), (t.zoom = { enabled: !1 });
      let l,
        o,
        c = 1,
        p = !1;
      const u = [],
        m = { originX: 0, originY: 0, slideEl: void 0, slideWidth: void 0, slideHeight: void 0, imageEl: void 0, imageWrapEl: void 0, maxRatio: 3 },
        h = { isTouched: void 0, isMoved: void 0, currentX: void 0, currentY: void 0, minX: void 0, minY: void 0, maxX: void 0, maxY: void 0, width: void 0, height: void 0, startX: void 0, startY: void 0, touchesStart: {}, touchesCurrent: {} },
        g = { x: void 0, y: void 0, prevPositionX: void 0, prevPositionY: void 0, prevTime: void 0 };
      let v,
        b = 1;
      function y() {
        if (u.length < 2) return 1;
        const e = u[0].pageX,
          t = u[0].pageY,
          s = u[1].pageX,
          a = u[1].pageY;
        return Math.sqrt((s - e) ** 2 + (a - t) ** 2);
      }
      function x() {
        const e = t.params.zoom,
          s = m.imageWrapEl.getAttribute("data-swiper-zoom") || e.maxRatio;
        if (e.limitToOriginalSize && m.imageEl && m.imageEl.naturalWidth) {
          const e = m.imageEl.naturalWidth / m.imageEl.offsetWidth;
          return Math.min(e, s);
        }
        return s;
      }
      function S(e) {
        const s = t.isElement ? "swiper-slide" : `.${t.params.slideClass}`;
        return !!e.target.matches(s) || t.slides.filter((t) => t.contains(e.target)).length > 0;
      }
      function T(e) {
        if (("mouse" === e.pointerType && u.splice(0, u.length), !S(e))) return;
        const s = t.params.zoom;
        if (((l = !1), (o = !1), u.push(e), !(u.length < 2))) {
          if (((l = !0), (m.scaleStart = y()), !m.slideEl)) {
            (m.slideEl = e.target.closest(`.${t.params.slideClass}, swiper-slide`)), m.slideEl || (m.slideEl = t.slides[t.activeIndex]);
            let a = m.slideEl.querySelector(`.${s.containerClass}`);
            if ((a && (a = a.querySelectorAll("picture, img, svg, canvas, .swiper-zoom-target")[0]), (m.imageEl = a), (m.imageWrapEl = a ? E(m.imageEl, `.${s.containerClass}`)[0] : void 0), !m.imageWrapEl)) return void (m.imageEl = void 0);
            m.maxRatio = x();
          }
          if (m.imageEl) {
            const [e, t] = (function () {
              if (u.length < 2) return { x: null, y: null };
              const e = m.imageEl.getBoundingClientRect();
              return [(u[0].pageX + (u[1].pageX - u[0].pageX) / 2 - e.x - n.scrollX) / c, (u[0].pageY + (u[1].pageY - u[0].pageY) / 2 - e.y - n.scrollY) / c];
            })();
            (m.originX = e), (m.originY = t), (m.imageEl.style.transitionDuration = "0ms");
          }
          p = !0;
        }
      }
      function M(e) {
        if (!S(e)) return;
        const s = t.params.zoom,
          a = t.zoom,
          i = u.findIndex((t) => t.pointerId === e.pointerId);
        i >= 0 && (u[i] = e), u.length < 2 || ((o = !0), (m.scaleMove = y()), m.imageEl && ((a.scale = (m.scaleMove / m.scaleStart) * c), a.scale > m.maxRatio && (a.scale = m.maxRatio - 1 + (a.scale - m.maxRatio + 1) ** 0.5), a.scale < s.minRatio && (a.scale = s.minRatio + 1 - (s.minRatio - a.scale + 1) ** 0.5), (m.imageEl.style.transform = `translate3d(0,0,0) scale(${a.scale})`)));
      }
      function C(e) {
        if (!S(e)) return;
        if ("mouse" === e.pointerType && "pointerout" === e.type) return;
        const s = t.params.zoom,
          a = t.zoom,
          i = u.findIndex((t) => t.pointerId === e.pointerId);
        i >= 0 && u.splice(i, 1), l && o && ((l = !1), (o = !1), m.imageEl && ((a.scale = Math.max(Math.min(a.scale, m.maxRatio), s.minRatio)), (m.imageEl.style.transitionDuration = `${t.params.speed}ms`), (m.imageEl.style.transform = `translate3d(0,0,0) scale(${a.scale})`), (c = a.scale), (p = !1), a.scale > 1 && m.slideEl ? m.slideEl.classList.add(`${s.zoomedSlideClass}`) : a.scale <= 1 && m.slideEl && m.slideEl.classList.remove(`${s.zoomedSlideClass}`), 1 === a.scale && ((m.originX = 0), (m.originY = 0), (m.slideEl = void 0))));
      }
      function P() {
        t.touchEventsData.preventTouchMoveFromPointerMove = !1;
      }
      function L(e) {
        if (
          !S(e) ||
          !(function (e) {
            const s = `.${t.params.zoom.containerClass}`;
            return !!e.target.matches(s) || [...t.hostEl.querySelectorAll(s)].filter((t) => t.contains(e.target)).length > 0;
          })(e)
        )
          return;
        const s = t.zoom;
        if (!m.imageEl) return;
        if (!h.isTouched || !m.slideEl) return;
        h.isMoved || ((h.width = m.imageEl.offsetWidth || m.imageEl.clientWidth), (h.height = m.imageEl.offsetHeight || m.imageEl.clientHeight), (h.startX = d(m.imageWrapEl, "x") || 0), (h.startY = d(m.imageWrapEl, "y") || 0), (m.slideWidth = m.slideEl.offsetWidth), (m.slideHeight = m.slideEl.offsetHeight), (m.imageWrapEl.style.transitionDuration = "0ms"));
        const a = h.width * s.scale,
          i = h.height * s.scale;
        (h.minX = Math.min(m.slideWidth / 2 - a / 2, 0)), (h.maxX = -h.minX), (h.minY = Math.min(m.slideHeight / 2 - i / 2, 0)), (h.maxY = -h.minY), (h.touchesCurrent.x = u.length > 0 ? u[0].pageX : e.pageX), (h.touchesCurrent.y = u.length > 0 ? u[0].pageY : e.pageY);
        if ((Math.max(Math.abs(h.touchesCurrent.x - h.touchesStart.x), Math.abs(h.touchesCurrent.y - h.touchesStart.y)) > 5 && (t.allowClick = !1), !h.isMoved && !p)) {
          if (t.isHorizontal() && ((Math.floor(h.minX) === Math.floor(h.startX) && h.touchesCurrent.x < h.touchesStart.x) || (Math.floor(h.maxX) === Math.floor(h.startX) && h.touchesCurrent.x > h.touchesStart.x))) return (h.isTouched = !1), void P();
          if (!t.isHorizontal() && ((Math.floor(h.minY) === Math.floor(h.startY) && h.touchesCurrent.y < h.touchesStart.y) || (Math.floor(h.maxY) === Math.floor(h.startY) && h.touchesCurrent.y > h.touchesStart.y))) return (h.isTouched = !1), void P();
        }
        e.cancelable && e.preventDefault(),
          e.stopPropagation(),
          clearTimeout(v),
          (t.touchEventsData.preventTouchMoveFromPointerMove = !0),
          (v = setTimeout(() => {
            P();
          })),
          (h.isMoved = !0);
        const r = (s.scale - c) / (m.maxRatio - t.params.zoom.minRatio),
          { originX: n, originY: l } = m;
        (h.currentX = h.touchesCurrent.x - h.touchesStart.x + h.startX + r * (h.width - 2 * n)),
          (h.currentY = h.touchesCurrent.y - h.touchesStart.y + h.startY + r * (h.height - 2 * l)),
          h.currentX < h.minX && (h.currentX = h.minX + 1 - (h.minX - h.currentX + 1) ** 0.8),
          h.currentX > h.maxX && (h.currentX = h.maxX - 1 + (h.currentX - h.maxX + 1) ** 0.8),
          h.currentY < h.minY && (h.currentY = h.minY + 1 - (h.minY - h.currentY + 1) ** 0.8),
          h.currentY > h.maxY && (h.currentY = h.maxY - 1 + (h.currentY - h.maxY + 1) ** 0.8),
          g.prevPositionX || (g.prevPositionX = h.touchesCurrent.x),
          g.prevPositionY || (g.prevPositionY = h.touchesCurrent.y),
          g.prevTime || (g.prevTime = Date.now()),
          (g.x = (h.touchesCurrent.x - g.prevPositionX) / (Date.now() - g.prevTime) / 2),
          (g.y = (h.touchesCurrent.y - g.prevPositionY) / (Date.now() - g.prevTime) / 2),
          Math.abs(h.touchesCurrent.x - g.prevPositionX) < 2 && (g.x = 0),
          Math.abs(h.touchesCurrent.y - g.prevPositionY) < 2 && (g.y = 0),
          (g.prevPositionX = h.touchesCurrent.x),
          (g.prevPositionY = h.touchesCurrent.y),
          (g.prevTime = Date.now()),
          (m.imageWrapEl.style.transform = `translate3d(${h.currentX}px, ${h.currentY}px,0)`);
      }
      function I() {
        const e = t.zoom;
        m.slideEl && t.activeIndex !== t.slides.indexOf(m.slideEl) && (m.imageEl && (m.imageEl.style.transform = "translate3d(0,0,0) scale(1)"), m.imageWrapEl && (m.imageWrapEl.style.transform = "translate3d(0,0,0)"), m.slideEl.classList.remove(`${t.params.zoom.zoomedSlideClass}`), (e.scale = 1), (c = 1), (m.slideEl = void 0), (m.imageEl = void 0), (m.imageWrapEl = void 0), (m.originX = 0), (m.originY = 0));
      }
      function A(e) {
        const s = t.zoom,
          a = t.params.zoom;
        if (!m.slideEl) {
          e && e.target && (m.slideEl = e.target.closest(`.${t.params.slideClass}, swiper-slide`)), m.slideEl || (t.params.virtual && t.params.virtual.enabled && t.virtual ? (m.slideEl = f(t.slidesEl, `.${t.params.slideActiveClass}`)[0]) : (m.slideEl = t.slides[t.activeIndex]));
          let s = m.slideEl.querySelector(`.${a.containerClass}`);
          s && (s = s.querySelectorAll("picture, img, svg, canvas, .swiper-zoom-target")[0]), (m.imageEl = s), (m.imageWrapEl = s ? E(m.imageEl, `.${a.containerClass}`)[0] : void 0);
        }
        if (!m.imageEl || !m.imageWrapEl) return;
        let i, r, l, o, d, p, u, g, v, b, y, S, T, M, C, P, L, I;
        t.params.cssMode && ((t.wrapperEl.style.overflow = "hidden"), (t.wrapperEl.style.touchAction = "none")), m.slideEl.classList.add(`${a.zoomedSlideClass}`), void 0 === h.touchesStart.x && e ? ((i = e.pageX), (r = e.pageY)) : ((i = h.touchesStart.x), (r = h.touchesStart.y));
        const A = "number" == typeof e ? e : null;
        1 === c && A && ((i = void 0), (r = void 0));
        const z = x();
        (s.scale = A || z), (c = A || z), !e || (1 === c && A) ? ((u = 0), (g = 0)) : ((L = m.slideEl.offsetWidth), (I = m.slideEl.offsetHeight), (l = w(m.slideEl).left + n.scrollX), (o = w(m.slideEl).top + n.scrollY), (d = l + L / 2 - i), (p = o + I / 2 - r), (v = m.imageEl.offsetWidth || m.imageEl.clientWidth), (b = m.imageEl.offsetHeight || m.imageEl.clientHeight), (y = v * s.scale), (S = b * s.scale), (T = Math.min(L / 2 - y / 2, 0)), (M = Math.min(I / 2 - S / 2, 0)), (C = -T), (P = -M), (u = d * s.scale), (g = p * s.scale), u < T && (u = T), u > C && (u = C), g < M && (g = M), g > P && (g = P)), A && 1 === s.scale && ((m.originX = 0), (m.originY = 0)), (m.imageWrapEl.style.transitionDuration = "300ms"), (m.imageWrapEl.style.transform = `translate3d(${u}px, ${g}px,0)`), (m.imageEl.style.transitionDuration = "300ms"), (m.imageEl.style.transform = `translate3d(0,0,0) scale(${s.scale})`);
      }
      function z() {
        const e = t.zoom,
          s = t.params.zoom;
        if (!m.slideEl) {
          t.params.virtual && t.params.virtual.enabled && t.virtual ? (m.slideEl = f(t.slidesEl, `.${t.params.slideActiveClass}`)[0]) : (m.slideEl = t.slides[t.activeIndex]);
          let e = m.slideEl.querySelector(`.${s.containerClass}`);
          e && (e = e.querySelectorAll("picture, img, svg, canvas, .swiper-zoom-target")[0]), (m.imageEl = e), (m.imageWrapEl = e ? E(m.imageEl, `.${s.containerClass}`)[0] : void 0);
        }
        m.imageEl && m.imageWrapEl && (t.params.cssMode && ((t.wrapperEl.style.overflow = ""), (t.wrapperEl.style.touchAction = "")), (e.scale = 1), (c = 1), (m.imageWrapEl.style.transitionDuration = "300ms"), (m.imageWrapEl.style.transform = "translate3d(0,0,0)"), (m.imageEl.style.transitionDuration = "300ms"), (m.imageEl.style.transform = "translate3d(0,0,0) scale(1)"), m.slideEl.classList.remove(`${s.zoomedSlideClass}`), (m.slideEl = void 0), (m.originX = 0), (m.originY = 0));
      }
      function $(e) {
        const s = t.zoom;
        s.scale && 1 !== s.scale ? z() : A(e);
      }
      function k() {
        return { passiveListener: !!t.params.passiveListeners && { passive: !0, capture: !1 }, activeListenerWithCapture: !t.params.passiveListeners || { passive: !1, capture: !0 } };
      }
      function O() {
        const e = t.zoom;
        if (e.enabled) return;
        e.enabled = !0;
        const { passiveListener: s, activeListenerWithCapture: a } = k();
        t.wrapperEl.addEventListener("pointerdown", T, s),
          t.wrapperEl.addEventListener("pointermove", M, a),
          ["pointerup", "pointercancel", "pointerout"].forEach((e) => {
            t.wrapperEl.addEventListener(e, C, s);
          }),
          t.wrapperEl.addEventListener("pointermove", L, a);
      }
      function D() {
        const e = t.zoom;
        if (!e.enabled) return;
        e.enabled = !1;
        const { passiveListener: s, activeListenerWithCapture: a } = k();
        t.wrapperEl.removeEventListener("pointerdown", T, s),
          t.wrapperEl.removeEventListener("pointermove", M, a),
          ["pointerup", "pointercancel", "pointerout"].forEach((e) => {
            t.wrapperEl.removeEventListener(e, C, s);
          }),
          t.wrapperEl.removeEventListener("pointermove", L, a);
      }
      Object.defineProperty(t.zoom, "scale", {
        get: () => b,
        set(e) {
          if (b !== e) {
            const t = m.imageEl,
              s = m.slideEl;
            i("zoomChange", e, t, s);
          }
          b = e;
        },
      }),
        a("init", () => {
          t.params.zoom.enabled && O();
        }),
        a("destroy", () => {
          D();
        }),
        a("touchStart", (e, s) => {
          t.zoom.enabled &&
            (function (e) {
              const s = t.device;
              if (!m.imageEl) return;
              if (h.isTouched) return;
              s.android && e.cancelable && e.preventDefault(), (h.isTouched = !0);
              const a = u.length > 0 ? u[0] : e;
              (h.touchesStart.x = a.pageX), (h.touchesStart.y = a.pageY);
            })(s);
        }),
        a("touchEnd", (e, s) => {
          t.zoom.enabled &&
            (function () {
              const e = t.zoom;
              if (!m.imageEl) return;
              if (!h.isTouched || !h.isMoved) return (h.isTouched = !1), void (h.isMoved = !1);
              (h.isTouched = !1), (h.isMoved = !1);
              let s = 300,
                a = 300;
              const i = g.x * s,
                r = h.currentX + i,
                n = g.y * a,
                l = h.currentY + n;
              0 !== g.x && (s = Math.abs((r - h.currentX) / g.x)), 0 !== g.y && (a = Math.abs((l - h.currentY) / g.y));
              const o = Math.max(s, a);
              (h.currentX = r), (h.currentY = l);
              const d = h.width * e.scale,
                c = h.height * e.scale;
              (h.minX = Math.min(m.slideWidth / 2 - d / 2, 0)), (h.maxX = -h.minX), (h.minY = Math.min(m.slideHeight / 2 - c / 2, 0)), (h.maxY = -h.minY), (h.currentX = Math.max(Math.min(h.currentX, h.maxX), h.minX)), (h.currentY = Math.max(Math.min(h.currentY, h.maxY), h.minY)), (m.imageWrapEl.style.transitionDuration = `${o}ms`), (m.imageWrapEl.style.transform = `translate3d(${h.currentX}px, ${h.currentY}px,0)`);
            })();
        }),
        a("doubleTap", (e, s) => {
          !t.animating && t.params.zoom.enabled && t.zoom.enabled && t.params.zoom.toggle && $(s);
        }),
        a("transitionEnd", () => {
          t.zoom.enabled && t.params.zoom.enabled && I();
        }),
        a("slideChange", () => {
          t.zoom.enabled && t.params.zoom.enabled && t.params.cssMode && I();
        }),
        Object.assign(t.zoom, { enable: O, disable: D, in: A, out: z, toggle: $ });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a } = e;
      function i(e, t) {
        const s = (function () {
          let e, t, s;
          return (a, i) => {
            for (t = -1, e = a.length; e - t > 1; ) (s = (e + t) >> 1), a[s] <= i ? (t = s) : (e = s);
            return e;
          };
        })();
        let a, i;
        return (
          (this.x = e),
          (this.y = t),
          (this.lastIndex = e.length - 1),
          (this.interpolate = function (e) {
            return e ? ((i = s(this.x, e)), (a = i - 1), ((e - this.x[a]) * (this.y[i] - this.y[a])) / (this.x[i] - this.x[a]) + this.y[a]) : 0;
          }),
          this
        );
      }
      function r() {
        t.controller.control && t.controller.spline && ((t.controller.spline = void 0), delete t.controller.spline);
      }
      s({ controller: { control: void 0, inverse: !1, by: "slide" } }),
        (t.controller = { control: void 0 }),
        a("beforeInit", () => {
          if ("undefined" != typeof window && ("string" == typeof t.params.controller.control || t.params.controller.control instanceof HTMLElement)) {
            const e = document.querySelector(t.params.controller.control);
            if (e && e.swiper) t.controller.control = e.swiper;
            else if (e) {
              const s = (a) => {
                (t.controller.control = a.detail[0]), t.update(), e.removeEventListener("init", s);
              };
              e.addEventListener("init", s);
            }
          } else t.controller.control = t.params.controller.control;
        }),
        a("update", () => {
          r();
        }),
        a("resize", () => {
          r();
        }),
        a("observerUpdate", () => {
          r();
        }),
        a("setTranslate", (e, s, a) => {
          t.controller.control && !t.controller.control.destroyed && t.controller.setTranslate(s, a);
        }),
        a("setTransition", (e, s, a) => {
          t.controller.control && !t.controller.control.destroyed && t.controller.setTransition(s, a);
        }),
        Object.assign(t.controller, {
          setTranslate: function (e, s) {
            const a = t.controller.control;
            let r, n;
            const l = t.constructor;
            function o(e) {
              if (e.destroyed) return;
              const s = t.rtlTranslate ? -t.translate : t.translate;
              "slide" === t.params.controller.by &&
                (!(function (e) {
                  t.controller.spline = t.params.loop ? new i(t.slidesGrid, e.slidesGrid) : new i(t.snapGrid, e.snapGrid);
                })(e),
                (n = -t.controller.spline.interpolate(-s))),
                (n && "container" !== t.params.controller.by) || ((r = (e.maxTranslate() - e.minTranslate()) / (t.maxTranslate() - t.minTranslate())), (!Number.isNaN(r) && Number.isFinite(r)) || (r = 1), (n = (s - t.minTranslate()) * r + e.minTranslate())),
                t.params.controller.inverse && (n = e.maxTranslate() - n),
                e.updateProgress(n),
                e.setTranslate(n, t),
                e.updateActiveIndex(),
                e.updateSlidesClasses();
            }
            if (Array.isArray(a)) for (let e = 0; e < a.length; e += 1) a[e] !== s && a[e] instanceof l && o(a[e]);
            else a instanceof l && s !== a && o(a);
          },
          setTransition: function (e, s) {
            const a = t.constructor,
              i = t.controller.control;
            let r;
            function n(s) {
              s.destroyed ||
                (s.setTransition(e, t),
                0 !== e &&
                  (s.transitionStart(),
                  s.params.autoHeight &&
                    l(() => {
                      s.updateAutoHeight();
                    }),
                  x(s.wrapperEl, () => {
                    i && s.transitionEnd();
                  })));
            }
            if (Array.isArray(i)) for (r = 0; r < i.length; r += 1) i[r] !== s && i[r] instanceof a && n(i[r]);
            else i instanceof a && s !== i && n(i);
          },
        });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: i } = e;
      s({ a11y: { enabled: !0, notificationClass: "swiper-notification", prevSlideMessage: "Previous slide", nextSlideMessage: "Next slide", firstSlideMessage: "This is the first slide", lastSlideMessage: "This is the last slide", paginationBulletMessage: "Go to slide {{index}}", slideLabelMessage: "{{index}} / {{slidesLength}}", containerMessage: null, containerRoleDescriptionMessage: null, itemRoleDescriptionMessage: null, slideRole: "group", id: null } }), (t.a11y = { clicked: !1 });
      let r,
        n,
        l = null,
        o = new Date().getTime();
      function d(e) {
        const t = l;
        0 !== t.length && ((t.innerHTML = ""), (t.innerHTML = e));
      }
      function c(e) {
        (e = T(e)).forEach((e) => {
          e.setAttribute("tabIndex", "0");
        });
      }
      function p(e) {
        (e = T(e)).forEach((e) => {
          e.setAttribute("tabIndex", "-1");
        });
      }
      function u(e, t) {
        (e = T(e)).forEach((e) => {
          e.setAttribute("role", t);
        });
      }
      function m(e, t) {
        (e = T(e)).forEach((e) => {
          e.setAttribute("aria-roledescription", t);
        });
      }
      function h(e, t) {
        (e = T(e)).forEach((e) => {
          e.setAttribute("aria-label", t);
        });
      }
      function f(e) {
        (e = T(e)).forEach((e) => {
          e.setAttribute("aria-disabled", !0);
        });
      }
      function g(e) {
        (e = T(e)).forEach((e) => {
          e.setAttribute("aria-disabled", !1);
        });
      }
      function w(e) {
        if (13 !== e.keyCode && 32 !== e.keyCode) return;
        const s = t.params.a11y,
          a = e.target;
        if (!t.pagination || !t.pagination.el || (a !== t.pagination.el && !t.pagination.el.contains(e.target)) || e.target.matches(re(t.params.pagination.bulletClass))) {
          if (t.navigation && t.navigation.prevEl && t.navigation.nextEl) {
            const e = T(t.navigation.prevEl);
            T(t.navigation.nextEl).includes(a) && ((t.isEnd && !t.params.loop) || t.slideNext(), t.isEnd ? d(s.lastSlideMessage) : d(s.nextSlideMessage)), e.includes(a) && ((t.isBeginning && !t.params.loop) || t.slidePrev(), t.isBeginning ? d(s.firstSlideMessage) : d(s.prevSlideMessage));
          }
          t.pagination && a.matches(re(t.params.pagination.bulletClass)) && a.click();
        }
      }
      function b() {
        return t.pagination && t.pagination.bullets && t.pagination.bullets.length;
      }
      function E() {
        return b() && t.params.pagination.clickable;
      }
      const x = (e, t, s) => {
          c(e),
            "BUTTON" !== e.tagName && (u(e, "button"), e.addEventListener("keydown", w)),
            h(e, s),
            (function (e, t) {
              (e = T(e)).forEach((e) => {
                e.setAttribute("aria-controls", t);
              });
            })(e, t);
        },
        S = (e) => {
          n && n !== e.target && !n.contains(e.target) && (r = !0), (t.a11y.clicked = !0);
        },
        M = () => {
          (r = !1),
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                t.destroyed || (t.a11y.clicked = !1);
              });
            });
        },
        C = (e) => {
          o = new Date().getTime();
        },
        P = (e) => {
          if (t.a11y.clicked) return;
          if (new Date().getTime() - o < 100) return;
          const s = e.target.closest(`.${t.params.slideClass}, swiper-slide`);
          if (!s || !t.slides.includes(s)) return;
          n = s;
          const a = t.slides.indexOf(s) === t.activeIndex,
            i = t.params.watchSlidesProgress && t.visibleSlides && t.visibleSlides.includes(s);
          a ||
            i ||
            (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) ||
            (t.isHorizontal() ? (t.el.scrollLeft = 0) : (t.el.scrollTop = 0),
            requestAnimationFrame(() => {
              r || (t.params.loop ? t.slideToLoop(parseInt(s.getAttribute("data-swiper-slide-index")), 0) : t.slideTo(t.slides.indexOf(s), 0), (r = !1));
            }));
        },
        L = () => {
          const e = t.params.a11y;
          e.itemRoleDescriptionMessage && m(t.slides, e.itemRoleDescriptionMessage), e.slideRole && u(t.slides, e.slideRole);
          const s = t.slides.length;
          e.slideLabelMessage &&
            t.slides.forEach((a, i) => {
              const r = t.params.loop ? parseInt(a.getAttribute("data-swiper-slide-index"), 10) : i;
              h(a, e.slideLabelMessage.replace(/\{\{index\}\}/, r + 1).replace(/\{\{slidesLength\}\}/, s));
            });
        },
        I = () => {
          const e = t.params.a11y;
          t.el.append(l);
          const s = t.el;
          e.containerRoleDescriptionMessage && m(s, e.containerRoleDescriptionMessage), e.containerMessage && h(s, e.containerMessage);
          const i = t.wrapperEl,
            r = e.id || i.getAttribute("id") || `swiper-wrapper-${((n = 16), void 0 === n && (n = 16), "x".repeat(n).replace(/x/g, () => Math.round(16 * Math.random()).toString(16)))}`;
          var n;
          const o = t.params.autoplay && t.params.autoplay.enabled ? "off" : "polite";
          var d;
          (d = r),
            T(i).forEach((e) => {
              e.setAttribute("id", d);
            }),
            (function (e, t) {
              (e = T(e)).forEach((e) => {
                e.setAttribute("aria-live", t);
              });
            })(i, o),
            L();
          let { nextEl: c, prevEl: p } = t.navigation ? t.navigation : {};
          if (((c = T(c)), (p = T(p)), c && c.forEach((t) => x(t, r, e.nextSlideMessage)), p && p.forEach((t) => x(t, r, e.prevSlideMessage)), E())) {
            T(t.pagination.el).forEach((e) => {
              e.addEventListener("keydown", w);
            });
          }
          a().addEventListener("visibilitychange", C), t.el.addEventListener("focus", P, !0), t.el.addEventListener("focus", P, !0), t.el.addEventListener("pointerdown", S, !0), t.el.addEventListener("pointerup", M, !0);
        };
      i("beforeInit", () => {
        (l = v("span", t.params.a11y.notificationClass)), l.setAttribute("aria-live", "assertive"), l.setAttribute("aria-atomic", "true");
      }),
        i("afterInit", () => {
          t.params.a11y.enabled && I();
        }),
        i("slidesLengthChange snapGridLengthChange slidesGridLengthChange", () => {
          t.params.a11y.enabled && L();
        }),
        i("fromEdge toEdge afterInit lock unlock", () => {
          t.params.a11y.enabled &&
            (function () {
              if (t.params.loop || t.params.rewind || !t.navigation) return;
              const { nextEl: e, prevEl: s } = t.navigation;
              s && (t.isBeginning ? (f(s), p(s)) : (g(s), c(s))), e && (t.isEnd ? (f(e), p(e)) : (g(e), c(e)));
            })();
        }),
        i("paginationUpdate", () => {
          t.params.a11y.enabled &&
            (function () {
              const e = t.params.a11y;
              b() &&
                t.pagination.bullets.forEach((s) => {
                  t.params.pagination.clickable && (c(s), t.params.pagination.renderBullet || (u(s, "button"), h(s, e.paginationBulletMessage.replace(/\{\{index\}\}/, y(s) + 1)))), s.matches(re(t.params.pagination.bulletActiveClass)) ? s.setAttribute("aria-current", "true") : s.removeAttribute("aria-current");
                });
            })();
        }),
        i("destroy", () => {
          t.params.a11y.enabled &&
            (function () {
              l && l.remove();
              let { nextEl: e, prevEl: s } = t.navigation ? t.navigation : {};
              (e = T(e)),
                (s = T(s)),
                e && e.forEach((e) => e.removeEventListener("keydown", w)),
                s && s.forEach((e) => e.removeEventListener("keydown", w)),
                E() &&
                  T(t.pagination.el).forEach((e) => {
                    e.removeEventListener("keydown", w);
                  });
              a().removeEventListener("visibilitychange", C), t.el && "string" != typeof t.el && (t.el.removeEventListener("focus", P, !0), t.el.removeEventListener("pointerdown", S, !0), t.el.removeEventListener("pointerup", M, !0));
            })();
        });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a } = e;
      s({ history: { enabled: !1, root: "", replaceState: !1, key: "slides", keepQuery: !1 } });
      let i = !1,
        n = {};
      const l = (e) =>
          e
            .toString()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]+/g, "")
            .replace(/--+/g, "-")
            .replace(/^-+/, "")
            .replace(/-+$/, ""),
        o = (e) => {
          const t = r();
          let s;
          s = e ? new URL(e) : t.location;
          const a = s.pathname
              .slice(1)
              .split("/")
              .filter((e) => "" !== e),
            i = a.length;
          return { key: a[i - 2], value: a[i - 1] };
        },
        d = (e, s) => {
          const a = r();
          if (!i || !t.params.history.enabled) return;
          let n;
          n = t.params.url ? new URL(t.params.url) : a.location;
          const o = t.virtual && t.params.virtual.enabled ? t.slidesEl.querySelector(`[data-swiper-slide-index="${s}"]`) : t.slides[s];
          let d = l(o.getAttribute("data-history"));
          if (t.params.history.root.length > 0) {
            let s = t.params.history.root;
            "/" === s[s.length - 1] && (s = s.slice(0, s.length - 1)), (d = `${s}/${e ? `${e}/` : ""}${d}`);
          } else n.pathname.includes(e) || (d = `${e ? `${e}/` : ""}${d}`);
          t.params.history.keepQuery && (d += n.search);
          const c = a.history.state;
          (c && c.value === d) || (t.params.history.replaceState ? a.history.replaceState({ value: d }, null, d) : a.history.pushState({ value: d }, null, d));
        },
        c = (e, s, a) => {
          if (s)
            for (let i = 0, r = t.slides.length; i < r; i += 1) {
              const r = t.slides[i];
              if (l(r.getAttribute("data-history")) === s) {
                const s = t.getSlideIndex(r);
                t.slideTo(s, e, a);
              }
            }
          else t.slideTo(0, e, a);
        },
        p = () => {
          (n = o(t.params.url)), c(t.params.speed, n.value, !1);
        };
      a("init", () => {
        t.params.history.enabled &&
          (() => {
            const e = r();
            if (t.params.history) {
              if (!e.history || !e.history.pushState) return (t.params.history.enabled = !1), void (t.params.hashNavigation.enabled = !0);
              (i = !0), (n = o(t.params.url)), n.key || n.value ? (c(0, n.value, t.params.runCallbacksOnInit), t.params.history.replaceState || e.addEventListener("popstate", p)) : t.params.history.replaceState || e.addEventListener("popstate", p);
            }
          })();
      }),
        a("destroy", () => {
          t.params.history.enabled &&
            (() => {
              const e = r();
              t.params.history.replaceState || e.removeEventListener("popstate", p);
            })();
        }),
        a("transitionEnd _freeModeNoMomentumRelease", () => {
          i && d(t.params.history.key, t.activeIndex);
        }),
        a("slideChange", () => {
          i && t.params.cssMode && d(t.params.history.key, t.activeIndex);
        });
    },
    function (e) {
      let { swiper: t, extendParams: s, emit: i, on: n } = e,
        l = !1;
      const o = a(),
        d = r();
      s({
        hashNavigation: {
          enabled: !1,
          replaceState: !1,
          watchState: !1,
          getSlideIndex(e, s) {
            if (t.virtual && t.params.virtual.enabled) {
              const e = t.slides.filter((e) => e.getAttribute("data-hash") === s)[0];
              if (!e) return 0;
              return parseInt(e.getAttribute("data-swiper-slide-index"), 10);
            }
            return t.getSlideIndex(f(t.slidesEl, `.${t.params.slideClass}[data-hash="${s}"], swiper-slide[data-hash="${s}"]`)[0]);
          },
        },
      });
      const c = () => {
          i("hashChange");
          const e = o.location.hash.replace("#", ""),
            s = t.virtual && t.params.virtual.enabled ? t.slidesEl.querySelector(`[data-swiper-slide-index="${t.activeIndex}"]`) : t.slides[t.activeIndex];
          if (e !== (s ? s.getAttribute("data-hash") : "")) {
            const s = t.params.hashNavigation.getSlideIndex(t, e);
            if (void 0 === s || Number.isNaN(s)) return;
            t.slideTo(s);
          }
        },
        p = () => {
          if (!l || !t.params.hashNavigation.enabled) return;
          const e = t.virtual && t.params.virtual.enabled ? t.slidesEl.querySelector(`[data-swiper-slide-index="${t.activeIndex}"]`) : t.slides[t.activeIndex],
            s = e ? e.getAttribute("data-hash") || e.getAttribute("data-history") : "";
          t.params.hashNavigation.replaceState && d.history && d.history.replaceState ? (d.history.replaceState(null, null, `#${s}` || ""), i("hashSet")) : ((o.location.hash = s || ""), i("hashSet"));
        };
      n("init", () => {
        t.params.hashNavigation.enabled &&
          (() => {
            if (!t.params.hashNavigation.enabled || (t.params.history && t.params.history.enabled)) return;
            l = !0;
            const e = o.location.hash.replace("#", "");
            if (e) {
              const s = 0,
                a = t.params.hashNavigation.getSlideIndex(t, e);
              t.slideTo(a || 0, s, t.params.runCallbacksOnInit, !0);
            }
            t.params.hashNavigation.watchState && d.addEventListener("hashchange", c);
          })();
      }),
        n("destroy", () => {
          t.params.hashNavigation.enabled && t.params.hashNavigation.watchState && d.removeEventListener("hashchange", c);
        }),
        n("transitionEnd _freeModeNoMomentumRelease", () => {
          l && p();
        }),
        n("slideChange", () => {
          l && t.params.cssMode && p();
        });
    },
    function (e) {
      let t,
        s,
        { swiper: i, extendParams: r, on: n, emit: l, params: o } = e;
      (i.autoplay = { running: !1, paused: !1, timeLeft: 0 }), r({ autoplay: { enabled: !1, delay: 3e3, waitForTransition: !0, disableOnInteraction: !1, stopOnLastSlide: !1, reverseDirection: !1, pauseOnMouseEnter: !1 } });
      let d,
        c,
        p,
        u,
        m,
        h,
        f,
        g,
        v = o && o.autoplay ? o.autoplay.delay : 3e3,
        w = o && o.autoplay ? o.autoplay.delay : 3e3,
        b = new Date().getTime();
      function y(e) {
        i && !i.destroyed && i.wrapperEl && e.target === i.wrapperEl && (i.wrapperEl.removeEventListener("transitionend", y), g || (e.detail && e.detail.bySwiperTouchMove) || C());
      }
      const E = () => {
          if (i.destroyed || !i.autoplay.running) return;
          i.autoplay.paused ? (c = !0) : c && ((w = d), (c = !1));
          const e = i.autoplay.paused ? d : b + w - new Date().getTime();
          (i.autoplay.timeLeft = e),
            l("autoplayTimeLeft", e, e / v),
            (s = requestAnimationFrame(() => {
              E();
            }));
        },
        x = (e) => {
          if (i.destroyed || !i.autoplay.running) return;
          cancelAnimationFrame(s), E();
          let a = void 0 === e ? i.params.autoplay.delay : e;
          (v = i.params.autoplay.delay), (w = i.params.autoplay.delay);
          const r = (() => {
            let e;
            if (((e = i.virtual && i.params.virtual.enabled ? i.slides.filter((e) => e.classList.contains("swiper-slide-active"))[0] : i.slides[i.activeIndex]), !e)) return;
            return parseInt(e.getAttribute("data-swiper-autoplay"), 10);
          })();
          !Number.isNaN(r) && r > 0 && void 0 === e && ((a = r), (v = r), (w = r)), (d = a);
          const n = i.params.speed,
            o = () => {
              i &&
                !i.destroyed &&
                (i.params.autoplay.reverseDirection ? (!i.isBeginning || i.params.loop || i.params.rewind ? (i.slidePrev(n, !0, !0), l("autoplay")) : i.params.autoplay.stopOnLastSlide || (i.slideTo(i.slides.length - 1, n, !0, !0), l("autoplay"))) : !i.isEnd || i.params.loop || i.params.rewind ? (i.slideNext(n, !0, !0), l("autoplay")) : i.params.autoplay.stopOnLastSlide || (i.slideTo(0, n, !0, !0), l("autoplay")),
                i.params.cssMode &&
                  ((b = new Date().getTime()),
                  requestAnimationFrame(() => {
                    x();
                  })));
            };
          return (
            a > 0
              ? (clearTimeout(t),
                (t = setTimeout(() => {
                  o();
                }, a)))
              : requestAnimationFrame(() => {
                  o();
                }),
            a
          );
        },
        S = () => {
          (b = new Date().getTime()), (i.autoplay.running = !0), x(), l("autoplayStart");
        },
        T = () => {
          (i.autoplay.running = !1), clearTimeout(t), cancelAnimationFrame(s), l("autoplayStop");
        },
        M = (e, s) => {
          if (i.destroyed || !i.autoplay.running) return;
          clearTimeout(t), e || (f = !0);
          const a = () => {
            l("autoplayPause"), i.params.autoplay.waitForTransition ? i.wrapperEl.addEventListener("transitionend", y) : C();
          };
          if (((i.autoplay.paused = !0), s)) return h && (d = i.params.autoplay.delay), (h = !1), void a();
          const r = d || i.params.autoplay.delay;
          (d = r - (new Date().getTime() - b)), (i.isEnd && d < 0 && !i.params.loop) || (d < 0 && (d = 0), a());
        },
        C = () => {
          (i.isEnd && d < 0 && !i.params.loop) || i.destroyed || !i.autoplay.running || ((b = new Date().getTime()), f ? ((f = !1), x(d)) : x(), (i.autoplay.paused = !1), l("autoplayResume"));
        },
        P = () => {
          if (i.destroyed || !i.autoplay.running) return;
          const e = a();
          "hidden" === e.visibilityState && ((f = !0), M(!0)), "visible" === e.visibilityState && C();
        },
        L = (e) => {
          "mouse" === e.pointerType && ((f = !0), (g = !0), i.animating || i.autoplay.paused || M(!0));
        },
        I = (e) => {
          "mouse" === e.pointerType && ((g = !1), i.autoplay.paused && C());
        };
      n("init", () => {
        i.params.autoplay.enabled && (i.params.autoplay.pauseOnMouseEnter && (i.el.addEventListener("pointerenter", L), i.el.addEventListener("pointerleave", I)), a().addEventListener("visibilitychange", P), S());
      }),
        n("destroy", () => {
          i.el && "string" != typeof i.el && (i.el.removeEventListener("pointerenter", L), i.el.removeEventListener("pointerleave", I)), a().removeEventListener("visibilitychange", P), i.autoplay.running && T();
        }),
        n("_freeModeStaticRelease", () => {
          (u || f) && C();
        }),
        n("_freeModeNoMomentumRelease", () => {
          i.params.autoplay.disableOnInteraction ? T() : M(!0, !0);
        }),
        n("beforeTransitionStart", (e, t, s) => {
          !i.destroyed && i.autoplay.running && (s || !i.params.autoplay.disableOnInteraction ? M(!0, !0) : T());
        }),
        n("sliderFirstMove", () => {
          !i.destroyed &&
            i.autoplay.running &&
            (i.params.autoplay.disableOnInteraction
              ? T()
              : ((p = !0),
                (u = !1),
                (f = !1),
                (m = setTimeout(() => {
                  (f = !0), (u = !0), M(!0);
                }, 200))));
        }),
        n("touchEnd", () => {
          if (!i.destroyed && i.autoplay.running && p) {
            if ((clearTimeout(m), clearTimeout(t), i.params.autoplay.disableOnInteraction)) return (u = !1), void (p = !1);
            u && i.params.cssMode && C(), (u = !1), (p = !1);
          }
        }),
        n("slideChange", () => {
          !i.destroyed && i.autoplay.running && (h = !0);
        }),
        Object.assign(i.autoplay, { start: S, stop: T, pause: M, resume: C });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: i } = e;
      s({ thumbs: { swiper: null, multipleActiveThumbs: !0, autoScrollOffset: 0, slideThumbActiveClass: "swiper-slide-thumb-active", thumbsContainerClass: "swiper-thumbs" } });
      let r = !1,
        n = !1;
      function l() {
        const e = t.thumbs.swiper;
        if (!e || e.destroyed) return;
        const s = e.clickedIndex,
          a = e.clickedSlide;
        if (a && a.classList.contains(t.params.thumbs.slideThumbActiveClass)) return;
        if (null == s) return;
        let i;
        (i = e.params.loop ? parseInt(e.clickedSlide.getAttribute("data-swiper-slide-index"), 10) : s), t.params.loop ? t.slideToLoop(i) : t.slideTo(i);
      }
      function o() {
        const { thumbs: e } = t.params;
        if (r) return !1;
        r = !0;
        const s = t.constructor;
        if (e.swiper instanceof s) (t.thumbs.swiper = e.swiper), Object.assign(t.thumbs.swiper.originalParams, { watchSlidesProgress: !0, slideToClickedSlide: !1 }), Object.assign(t.thumbs.swiper.params, { watchSlidesProgress: !0, slideToClickedSlide: !1 }), t.thumbs.swiper.update();
        else if (c(e.swiper)) {
          const a = Object.assign({}, e.swiper);
          Object.assign(a, { watchSlidesProgress: !0, slideToClickedSlide: !1 }), (t.thumbs.swiper = new s(a)), (n = !0);
        }
        return t.thumbs.swiper.el.classList.add(t.params.thumbs.thumbsContainerClass), t.thumbs.swiper.on("tap", l), !0;
      }
      function d(e) {
        const s = t.thumbs.swiper;
        if (!s || s.destroyed) return;
        const a = "auto" === s.params.slidesPerView ? s.slidesPerViewDynamic() : s.params.slidesPerView;
        let i = 1;
        const r = t.params.thumbs.slideThumbActiveClass;
        if ((t.params.slidesPerView > 1 && !t.params.centeredSlides && (i = t.params.slidesPerView), t.params.thumbs.multipleActiveThumbs || (i = 1), (i = Math.floor(i)), s.slides.forEach((e) => e.classList.remove(r)), s.params.loop || (s.params.virtual && s.params.virtual.enabled)))
          for (let e = 0; e < i; e += 1)
            f(s.slidesEl, `[data-swiper-slide-index="${t.realIndex + e}"]`).forEach((e) => {
              e.classList.add(r);
            });
        else for (let e = 0; e < i; e += 1) s.slides[t.realIndex + e] && s.slides[t.realIndex + e].classList.add(r);
        const n = t.params.thumbs.autoScrollOffset,
          l = n && !s.params.loop;
        if (t.realIndex !== s.realIndex || l) {
          const i = s.activeIndex;
          let r, o;
          if (s.params.loop) {
            const e = s.slides.filter((e) => e.getAttribute("data-swiper-slide-index") === `${t.realIndex}`)[0];
            (r = s.slides.indexOf(e)), (o = t.activeIndex > t.previousIndex ? "next" : "prev");
          } else (r = t.realIndex), (o = r > t.previousIndex ? "next" : "prev");
          l && (r += "next" === o ? n : -1 * n), s.visibleSlidesIndexes && s.visibleSlidesIndexes.indexOf(r) < 0 && (s.params.centeredSlides ? (r = r > i ? r - Math.floor(a / 2) + 1 : r + Math.floor(a / 2) - 1) : r > i && s.params.slidesPerGroup, s.slideTo(r, e ? 0 : void 0));
        }
      }
      (t.thumbs = { swiper: null }),
        i("beforeInit", () => {
          const { thumbs: e } = t.params;
          if (e && e.swiper)
            if ("string" == typeof e.swiper || e.swiper instanceof HTMLElement) {
              const s = a(),
                i = () => {
                  const a = "string" == typeof e.swiper ? s.querySelector(e.swiper) : e.swiper;
                  if (a && a.swiper) (e.swiper = a.swiper), o(), d(!0);
                  else if (a) {
                    const s = (i) => {
                      (e.swiper = i.detail[0]), a.removeEventListener("init", s), o(), d(!0), e.swiper.update(), t.update();
                    };
                    a.addEventListener("init", s);
                  }
                  return a;
                },
                r = () => {
                  if (t.destroyed) return;
                  i() || requestAnimationFrame(r);
                };
              requestAnimationFrame(r);
            } else o(), d(!0);
        }),
        i("slideChange update resize observerUpdate", () => {
          d();
        }),
        i("setTransition", (e, s) => {
          const a = t.thumbs.swiper;
          a && !a.destroyed && a.setTransition(s);
        }),
        i("beforeDestroy", () => {
          const e = t.thumbs.swiper;
          e && !e.destroyed && n && e.destroy();
        }),
        Object.assign(t.thumbs, { init: o, update: d });
    },
    function (e) {
      let { swiper: t, extendParams: s, emit: a, once: i } = e;
      s({ freeMode: { enabled: !1, momentum: !0, momentumRatio: 1, momentumBounce: !0, momentumBounceRatio: 1, momentumVelocityRatio: 1, sticky: !1, minimumVelocity: 0.02 } }),
        Object.assign(t, {
          freeMode: {
            onTouchStart: function () {
              if (t.params.cssMode) return;
              const e = t.getTranslate();
              t.setTranslate(e), t.setTransition(0), (t.touchEventsData.velocities.length = 0), t.freeMode.onTouchEnd({ currentPos: t.rtl ? t.translate : -t.translate });
            },
            onTouchMove: function () {
              if (t.params.cssMode) return;
              const { touchEventsData: e, touches: s } = t;
              0 === e.velocities.length && e.velocities.push({ position: s[t.isHorizontal() ? "startX" : "startY"], time: e.touchStartTime }), e.velocities.push({ position: s[t.isHorizontal() ? "currentX" : "currentY"], time: o() });
            },
            onTouchEnd: function (e) {
              let { currentPos: s } = e;
              if (t.params.cssMode) return;
              const { params: r, wrapperEl: n, rtlTranslate: l, snapGrid: d, touchEventsData: c } = t,
                p = o() - c.touchStartTime;
              if (s < -t.minTranslate()) t.slideTo(t.activeIndex);
              else if (s > -t.maxTranslate()) t.slides.length < d.length ? t.slideTo(d.length - 1) : t.slideTo(t.slides.length - 1);
              else {
                if (r.freeMode.momentum) {
                  if (c.velocities.length > 1) {
                    const e = c.velocities.pop(),
                      s = c.velocities.pop(),
                      a = e.position - s.position,
                      i = e.time - s.time;
                    (t.velocity = a / i), (t.velocity /= 2), Math.abs(t.velocity) < r.freeMode.minimumVelocity && (t.velocity = 0), (i > 150 || o() - e.time > 300) && (t.velocity = 0);
                  } else t.velocity = 0;
                  (t.velocity *= r.freeMode.momentumVelocityRatio), (c.velocities.length = 0);
                  let e = 1e3 * r.freeMode.momentumRatio;
                  const s = t.velocity * e;
                  let p = t.translate + s;
                  l && (p = -p);
                  let u,
                    m = !1;
                  const h = 20 * Math.abs(t.velocity) * r.freeMode.momentumBounceRatio;
                  let f;
                  if (p < t.maxTranslate()) r.freeMode.momentumBounce ? (p + t.maxTranslate() < -h && (p = t.maxTranslate() - h), (u = t.maxTranslate()), (m = !0), (c.allowMomentumBounce = !0)) : (p = t.maxTranslate()), r.loop && r.centeredSlides && (f = !0);
                  else if (p > t.minTranslate()) r.freeMode.momentumBounce ? (p - t.minTranslate() > h && (p = t.minTranslate() + h), (u = t.minTranslate()), (m = !0), (c.allowMomentumBounce = !0)) : (p = t.minTranslate()), r.loop && r.centeredSlides && (f = !0);
                  else if (r.freeMode.sticky) {
                    let e;
                    for (let t = 0; t < d.length; t += 1)
                      if (d[t] > -p) {
                        e = t;
                        break;
                      }
                    (p = Math.abs(d[e] - p) < Math.abs(d[e - 1] - p) || "next" === t.swipeDirection ? d[e] : d[e - 1]), (p = -p);
                  }
                  if (
                    (f &&
                      i("transitionEnd", () => {
                        t.loopFix();
                      }),
                    0 !== t.velocity)
                  ) {
                    if (((e = l ? Math.abs((-p - t.translate) / t.velocity) : Math.abs((p - t.translate) / t.velocity)), r.freeMode.sticky)) {
                      const s = Math.abs((l ? -p : p) - t.translate),
                        a = t.slidesSizesGrid[t.activeIndex];
                      e = s < a ? r.speed : s < 2 * a ? 1.5 * r.speed : 2.5 * r.speed;
                    }
                  } else if (r.freeMode.sticky) return void t.slideToClosest();
                  r.freeMode.momentumBounce && m
                    ? (t.updateProgress(u),
                      t.setTransition(e),
                      t.setTranslate(p),
                      t.transitionStart(!0, t.swipeDirection),
                      (t.animating = !0),
                      x(n, () => {
                        t &&
                          !t.destroyed &&
                          c.allowMomentumBounce &&
                          (a("momentumBounce"),
                          t.setTransition(r.speed),
                          setTimeout(() => {
                            t.setTranslate(u),
                              x(n, () => {
                                t && !t.destroyed && t.transitionEnd();
                              });
                          }, 0));
                      }))
                    : t.velocity
                    ? (a("_freeModeNoMomentumRelease"),
                      t.updateProgress(p),
                      t.setTransition(e),
                      t.setTranslate(p),
                      t.transitionStart(!0, t.swipeDirection),
                      t.animating ||
                        ((t.animating = !0),
                        x(n, () => {
                          t && !t.destroyed && t.transitionEnd();
                        })))
                    : t.updateProgress(p),
                    t.updateActiveIndex(),
                    t.updateSlidesClasses();
                } else {
                  if (r.freeMode.sticky) return void t.slideToClosest();
                  r.freeMode && a("_freeModeNoMomentumRelease");
                }
                (!r.freeMode.momentum || p >= r.longSwipesMs) && (a("_freeModeStaticRelease"), t.updateProgress(), t.updateActiveIndex(), t.updateSlidesClasses());
              }
            },
          },
        });
    },
    function (e) {
      let t,
        s,
        a,
        i,
        { swiper: r, extendParams: n, on: l } = e;
      n({ grid: { rows: 1, fill: "column" } });
      const o = () => {
        let e = r.params.spaceBetween;
        return "string" == typeof e && e.indexOf("%") >= 0 ? (e = (parseFloat(e.replace("%", "")) / 100) * r.size) : "string" == typeof e && (e = parseFloat(e)), e;
      };
      l("init", () => {
        i = r.params.grid && r.params.grid.rows > 1;
      }),
        l("update", () => {
          const { params: e, el: t } = r,
            s = e.grid && e.grid.rows > 1;
          i && !s ? (t.classList.remove(`${e.containerModifierClass}grid`, `${e.containerModifierClass}grid-column`), (a = 1), r.emitContainerClasses()) : !i && s && (t.classList.add(`${e.containerModifierClass}grid`), "column" === e.grid.fill && t.classList.add(`${e.containerModifierClass}grid-column`), r.emitContainerClasses()), (i = s);
        }),
        (r.grid = {
          initSlides: (e) => {
            const { slidesPerView: i } = r.params,
              { rows: n, fill: l } = r.params.grid,
              o = r.virtual && r.params.virtual.enabled ? r.virtual.slides.length : e.length;
            (a = Math.floor(o / n)), (t = Math.floor(o / n) === o / n ? o : Math.ceil(o / n) * n), "auto" !== i && "row" === l && (t = Math.max(t, i * n)), (s = t / n);
          },
          unsetSlides: () => {
            r.slides &&
              r.slides.forEach((e) => {
                e.swiperSlideGridSet && ((e.style.height = ""), (e.style[r.getDirectionLabel("margin-top")] = ""));
              });
          },
          updateSlide: (e, i, n) => {
            const { slidesPerGroup: l } = r.params,
              d = o(),
              { rows: c, fill: p } = r.params.grid,
              u = r.virtual && r.params.virtual.enabled ? r.virtual.slides.length : n.length;
            let m, h, f;
            if ("row" === p && l > 1) {
              const s = Math.floor(e / (l * c)),
                a = e - c * l * s,
                r = 0 === s ? l : Math.min(Math.ceil((u - s * c * l) / c), l);
              (f = Math.floor(a / r)), (h = a - f * r + s * l), (m = h + (f * t) / c), (i.style.order = m);
            } else "column" === p ? ((h = Math.floor(e / c)), (f = e - h * c), (h > a || (h === a && f === c - 1)) && ((f += 1), f >= c && ((f = 0), (h += 1)))) : ((f = Math.floor(e / s)), (h = e - f * s));
            (i.row = f), (i.column = h), (i.style.height = `calc((100% - ${(c - 1) * d}px) / ${c})`), (i.style[r.getDirectionLabel("margin-top")] = 0 !== f ? d && `${d}px` : ""), (i.swiperSlideGridSet = !0);
          },
          updateWrapperSize: (e, s) => {
            const { centeredSlides: a, roundLengths: i } = r.params,
              n = o(),
              { rows: l } = r.params.grid;
            if (((r.virtualSize = (e + n) * t), (r.virtualSize = Math.ceil(r.virtualSize / l) - n), r.params.cssMode || (r.wrapperEl.style[r.getDirectionLabel("width")] = `${r.virtualSize + n}px`), a)) {
              const e = [];
              for (let t = 0; t < s.length; t += 1) {
                let a = s[t];
                i && (a = Math.floor(a)), s[t] < r.virtualSize + s[0] && e.push(a);
              }
              s.splice(0, s.length), s.push(...e);
            }
          },
        });
    },
    function (e) {
      let { swiper: t } = e;
      Object.assign(t, { appendSlide: ne.bind(t), prependSlide: le.bind(t), addSlide: oe.bind(t), removeSlide: de.bind(t), removeAllSlides: ce.bind(t) });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a } = e;
      s({ fadeEffect: { crossFade: !1 } }),
        pe({
          effect: "fade",
          swiper: t,
          on: a,
          setTranslate: () => {
            const { slides: e } = t;
            t.params.fadeEffect;
            for (let s = 0; s < e.length; s += 1) {
              const e = t.slides[s];
              let a = -e.swiperSlideOffset;
              t.params.virtualTranslate || (a -= t.translate);
              let i = 0;
              t.isHorizontal() || ((i = a), (a = 0));
              const r = t.params.fadeEffect.crossFade ? Math.max(1 - Math.abs(e.progress), 0) : 1 + Math.min(Math.max(e.progress, -1), 0),
                n = ue(0, e);
              (n.style.opacity = r), (n.style.transform = `translate3d(${a}px, ${i}px, 0px)`);
            }
          },
          setTransition: (e) => {
            const s = t.slides.map((e) => h(e));
            s.forEach((t) => {
              t.style.transitionDuration = `${e}ms`;
            }),
              me({ swiper: t, duration: e, transformElements: s, allSlides: !0 });
          },
          overwriteParams: () => ({ slidesPerView: 1, slidesPerGroup: 1, watchSlidesProgress: !0, spaceBetween: 0, virtualTranslate: !t.params.cssMode }),
        });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a } = e;
      s({ cubeEffect: { slideShadows: !0, shadow: !0, shadowOffset: 20, shadowScale: 0.94 } });
      const i = (e, t, s) => {
        let a = s ? e.querySelector(".swiper-slide-shadow-left") : e.querySelector(".swiper-slide-shadow-top"),
          i = s ? e.querySelector(".swiper-slide-shadow-right") : e.querySelector(".swiper-slide-shadow-bottom");
        a || ((a = v("div", ("swiper-slide-shadow-cube swiper-slide-shadow-" + (s ? "left" : "top")).split(" "))), e.append(a)), i || ((i = v("div", ("swiper-slide-shadow-cube swiper-slide-shadow-" + (s ? "right" : "bottom")).split(" "))), e.append(i)), a && (a.style.opacity = Math.max(-t, 0)), i && (i.style.opacity = Math.max(t, 0));
      };
      pe({
        effect: "cube",
        swiper: t,
        on: a,
        setTranslate: () => {
          const { el: e, wrapperEl: s, slides: a, width: r, height: n, rtlTranslate: l, size: o, browser: d } = t,
            c = t.params.cubeEffect,
            p = t.isHorizontal(),
            u = t.virtual && t.params.virtual.enabled;
          let m,
            h = 0;
          c.shadow && (p ? ((m = t.wrapperEl.querySelector(".swiper-cube-shadow")), m || ((m = v("div", "swiper-cube-shadow")), t.wrapperEl.append(m)), (m.style.height = `${r}px`)) : ((m = e.querySelector(".swiper-cube-shadow")), m || ((m = v("div", "swiper-cube-shadow")), e.append(m))));
          for (let e = 0; e < a.length; e += 1) {
            const s = a[e];
            let r = e;
            u && (r = parseInt(s.getAttribute("data-swiper-slide-index"), 10));
            let n = 90 * r,
              d = Math.floor(n / 360);
            l && ((n = -n), (d = Math.floor(-n / 360)));
            const m = Math.max(Math.min(s.progress, 1), -1);
            let f = 0,
              g = 0,
              v = 0;
            r % 4 == 0 ? ((f = 4 * -d * o), (v = 0)) : (r - 1) % 4 == 0 ? ((f = 0), (v = 4 * -d * o)) : (r - 2) % 4 == 0 ? ((f = o + 4 * d * o), (v = o)) : (r - 3) % 4 == 0 && ((f = -o), (v = 3 * o + 4 * o * d)), l && (f = -f), p || ((g = f), (f = 0));
            const w = `rotateX(${p ? 0 : -n}deg) rotateY(${p ? n : 0}deg) translate3d(${f}px, ${g}px, ${v}px)`;
            m <= 1 && m > -1 && ((h = 90 * r + 90 * m), l && (h = 90 * -r - 90 * m), t.browser && t.browser.need3dFix && (Math.abs(h) / 90) % 2 == 1 && (h += 0.001)), (s.style.transform = w), c.slideShadows && i(s, m, p);
          }
          if (((s.style.transformOrigin = `50% 50% -${o / 2}px`), (s.style["-webkit-transform-origin"] = `50% 50% -${o / 2}px`), c.shadow))
            if (p) m.style.transform = `translate3d(0px, ${r / 2 + c.shadowOffset}px, ${-r / 2}px) rotateX(89.99deg) rotateZ(0deg) scale(${c.shadowScale})`;
            else {
              const e = Math.abs(h) - 90 * Math.floor(Math.abs(h) / 90),
                t = 1.5 - (Math.sin((2 * e * Math.PI) / 360) / 2 + Math.cos((2 * e * Math.PI) / 360) / 2),
                s = c.shadowScale,
                a = c.shadowScale / t,
                i = c.shadowOffset;
              m.style.transform = `scale3d(${s}, 1, ${a}) translate3d(0px, ${n / 2 + i}px, ${-n / 2 / a}px) rotateX(-89.99deg)`;
            }
          const f = (d.isSafari || d.isWebView) && d.needPerspectiveFix ? -o / 2 : 0;
          (s.style.transform = `translate3d(0px,0,${f}px) rotateX(${t.isHorizontal() ? 0 : h}deg) rotateY(${t.isHorizontal() ? -h : 0}deg)`), s.style.setProperty("--swiper-cube-translate-z", `${f}px`);
        },
        setTransition: (e) => {
          const { el: s, slides: a } = t;
          if (
            (a.forEach((t) => {
              (t.style.transitionDuration = `${e}ms`),
                t.querySelectorAll(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").forEach((t) => {
                  t.style.transitionDuration = `${e}ms`;
                });
            }),
            t.params.cubeEffect.shadow && !t.isHorizontal())
          ) {
            const t = s.querySelector(".swiper-cube-shadow");
            t && (t.style.transitionDuration = `${e}ms`);
          }
        },
        recreateShadows: () => {
          const e = t.isHorizontal();
          t.slides.forEach((t) => {
            const s = Math.max(Math.min(t.progress, 1), -1);
            i(t, s, e);
          });
        },
        getEffectParams: () => t.params.cubeEffect,
        perspective: () => !0,
        overwriteParams: () => ({ slidesPerView: 1, slidesPerGroup: 1, watchSlidesProgress: !0, resistanceRatio: 0, spaceBetween: 0, centeredSlides: !1, virtualTranslate: !0 }),
      });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a } = e;
      s({ flipEffect: { slideShadows: !0, limitRotation: !0 } });
      const i = (e, s) => {
        let a = t.isHorizontal() ? e.querySelector(".swiper-slide-shadow-left") : e.querySelector(".swiper-slide-shadow-top"),
          i = t.isHorizontal() ? e.querySelector(".swiper-slide-shadow-right") : e.querySelector(".swiper-slide-shadow-bottom");
        a || (a = he("flip", e, t.isHorizontal() ? "left" : "top")), i || (i = he("flip", e, t.isHorizontal() ? "right" : "bottom")), a && (a.style.opacity = Math.max(-s, 0)), i && (i.style.opacity = Math.max(s, 0));
      };
      pe({
        effect: "flip",
        swiper: t,
        on: a,
        setTranslate: () => {
          const { slides: e, rtlTranslate: s } = t,
            a = t.params.flipEffect;
          for (let r = 0; r < e.length; r += 1) {
            const n = e[r];
            let l = n.progress;
            t.params.flipEffect.limitRotation && (l = Math.max(Math.min(n.progress, 1), -1));
            const o = n.swiperSlideOffset;
            let d = -180 * l,
              c = 0,
              p = t.params.cssMode ? -o - t.translate : -o,
              u = 0;
            t.isHorizontal() ? s && (d = -d) : ((u = p), (p = 0), (c = -d), (d = 0)), t.browser && t.browser.need3dFix && ((Math.abs(d) / 90) % 2 == 1 && (d += 0.001), (Math.abs(c) / 90) % 2 == 1 && (c += 0.001)), (n.style.zIndex = -Math.abs(Math.round(l)) + e.length), a.slideShadows && i(n, l);
            const m = `translate3d(${p}px, ${u}px, 0px) rotateX(${c}deg) rotateY(${d}deg)`;
            ue(0, n).style.transform = m;
          }
        },
        setTransition: (e) => {
          const s = t.slides.map((e) => h(e));
          s.forEach((t) => {
            (t.style.transitionDuration = `${e}ms`),
              t.querySelectorAll(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").forEach((t) => {
                t.style.transitionDuration = `${e}ms`;
              });
          }),
            me({ swiper: t, duration: e, transformElements: s });
        },
        recreateShadows: () => {
          t.params.flipEffect,
            t.slides.forEach((e) => {
              let s = e.progress;
              t.params.flipEffect.limitRotation && (s = Math.max(Math.min(e.progress, 1), -1)), i(e, s);
            });
        },
        getEffectParams: () => t.params.flipEffect,
        perspective: () => !0,
        overwriteParams: () => ({ slidesPerView: 1, slidesPerGroup: 1, watchSlidesProgress: !0, spaceBetween: 0, virtualTranslate: !t.params.cssMode }),
      });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a } = e;
      s({ coverflowEffect: { rotate: 50, stretch: 0, depth: 100, scale: 1, modifier: 1, slideShadows: !0 } }),
        pe({
          effect: "coverflow",
          swiper: t,
          on: a,
          setTranslate: () => {
            const { width: e, height: s, slides: a, slidesSizesGrid: i } = t,
              r = t.params.coverflowEffect,
              n = t.isHorizontal(),
              l = t.translate,
              o = n ? e / 2 - l : s / 2 - l,
              d = n ? r.rotate : -r.rotate,
              c = r.depth;
            for (let e = 0, s = a.length; e < s; e += 1) {
              const s = a[e],
                l = i[e],
                p = (o - s.swiperSlideOffset - l / 2) / l,
                u = "function" == typeof r.modifier ? r.modifier(p) : p * r.modifier;
              let m = n ? d * u : 0,
                h = n ? 0 : d * u,
                f = -c * Math.abs(u),
                g = r.stretch;
              "string" == typeof g && -1 !== g.indexOf("%") && (g = (parseFloat(r.stretch) / 100) * l);
              let v = n ? 0 : g * u,
                w = n ? g * u : 0,
                b = 1 - (1 - r.scale) * Math.abs(u);
              Math.abs(w) < 0.001 && (w = 0), Math.abs(v) < 0.001 && (v = 0), Math.abs(f) < 0.001 && (f = 0), Math.abs(m) < 0.001 && (m = 0), Math.abs(h) < 0.001 && (h = 0), Math.abs(b) < 0.001 && (b = 0), t.browser && t.browser.need3dFix && ((Math.abs(m) / 90) % 2 == 1 && (m += 0.001), (Math.abs(h) / 90) % 2 == 1 && (h += 0.001));
              const y = `translate3d(${w}px,${v}px,${f}px)  rotateX(${h}deg) rotateY(${m}deg) scale(${b})`;
              if (((ue(0, s).style.transform = y), (s.style.zIndex = 1 - Math.abs(Math.round(u))), r.slideShadows)) {
                let e = n ? s.querySelector(".swiper-slide-shadow-left") : s.querySelector(".swiper-slide-shadow-top"),
                  t = n ? s.querySelector(".swiper-slide-shadow-right") : s.querySelector(".swiper-slide-shadow-bottom");
                e || (e = he("coverflow", s, n ? "left" : "top")), t || (t = he("coverflow", s, n ? "right" : "bottom")), e && (e.style.opacity = u > 0 ? u : 0), t && (t.style.opacity = -u > 0 ? -u : 0);
              }
            }
          },
          setTransition: (e) => {
            t.slides
              .map((e) => h(e))
              .forEach((t) => {
                (t.style.transitionDuration = `${e}ms`),
                  t.querySelectorAll(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").forEach((t) => {
                    t.style.transitionDuration = `${e}ms`;
                  });
              });
          },
          perspective: () => !0,
          overwriteParams: () => ({ watchSlidesProgress: !0 }),
        });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a } = e;
      s({ creativeEffect: { limitProgress: 1, shadowPerProgress: !1, progressMultiplier: 1, perspective: !0, prev: { translate: [0, 0, 0], rotate: [0, 0, 0], opacity: 1, scale: 1 }, next: { translate: [0, 0, 0], rotate: [0, 0, 0], opacity: 1, scale: 1 } } });
      const i = (e) => ("string" == typeof e ? e : `${e}px`);
      pe({
        effect: "creative",
        swiper: t,
        on: a,
        setTranslate: () => {
          const { slides: e, wrapperEl: s, slidesSizesGrid: a } = t,
            r = t.params.creativeEffect,
            { progressMultiplier: n } = r,
            l = t.params.centeredSlides;
          if (l) {
            const e = a[0] / 2 - t.params.slidesOffsetBefore || 0;
            s.style.transform = `translateX(calc(50% - ${e}px))`;
          }
          for (let s = 0; s < e.length; s += 1) {
            const a = e[s],
              o = a.progress,
              d = Math.min(Math.max(a.progress, -r.limitProgress), r.limitProgress);
            let c = d;
            l || (c = Math.min(Math.max(a.originalProgress, -r.limitProgress), r.limitProgress));
            const p = a.swiperSlideOffset,
              u = [t.params.cssMode ? -p - t.translate : -p, 0, 0],
              m = [0, 0, 0];
            let h = !1;
            t.isHorizontal() || ((u[1] = u[0]), (u[0] = 0));
            let f = { translate: [0, 0, 0], rotate: [0, 0, 0], scale: 1, opacity: 1 };
            d < 0 ? ((f = r.next), (h = !0)) : d > 0 && ((f = r.prev), (h = !0)),
              u.forEach((e, t) => {
                u[t] = `calc(${e}px + (${i(f.translate[t])} * ${Math.abs(d * n)}))`;
              }),
              m.forEach((e, s) => {
                let a = f.rotate[s] * Math.abs(d * n);
                t.browser && t.browser.need3dFix && (Math.abs(a) / 90) % 2 == 1 && (a += 0.001), (m[s] = a);
              }),
              (a.style.zIndex = -Math.abs(Math.round(o)) + e.length);
            const g = u.join(", "),
              v = `rotateX(${m[0]}deg) rotateY(${m[1]}deg) rotateZ(${m[2]}deg)`,
              w = c < 0 ? `scale(${1 + (1 - f.scale) * c * n})` : `scale(${1 - (1 - f.scale) * c * n})`,
              b = c < 0 ? 1 + (1 - f.opacity) * c * n : 1 - (1 - f.opacity) * c * n,
              y = `translate3d(${g}) ${v} ${w}`;
            if ((h && f.shadow) || !h) {
              let e = a.querySelector(".swiper-slide-shadow");
              if ((!e && f.shadow && (e = he("creative", a)), e)) {
                const t = r.shadowPerProgress ? d * (1 / r.limitProgress) : d;
                e.style.opacity = Math.min(Math.max(Math.abs(t), 0), 1);
              }
            }
            const E = ue(0, a);
            (E.style.transform = y), (E.style.opacity = b), f.origin && (E.style.transformOrigin = f.origin);
          }
        },
        setTransition: (e) => {
          const s = t.slides.map((e) => h(e));
          s.forEach((t) => {
            (t.style.transitionDuration = `${e}ms`),
              t.querySelectorAll(".swiper-slide-shadow").forEach((t) => {
                t.style.transitionDuration = `${e}ms`;
              });
          }),
            me({ swiper: t, duration: e, transformElements: s, allSlides: !0 });
        },
        perspective: () => t.params.creativeEffect.perspective,
        overwriteParams: () => ({ watchSlidesProgress: !0, virtualTranslate: !t.params.cssMode }),
      });
    },
    function (e) {
      let { swiper: t, extendParams: s, on: a } = e;
      s({ cardsEffect: { slideShadows: !0, rotate: !0, perSlideRotate: 2, perSlideOffset: 8 } }),
        pe({
          effect: "cards",
          swiper: t,
          on: a,
          setTranslate: () => {
            const { slides: e, activeIndex: s, rtlTranslate: a } = t,
              i = t.params.cardsEffect,
              { startTranslate: r, isTouched: n } = t.touchEventsData,
              l = a ? -t.translate : t.translate;
            for (let o = 0; o < e.length; o += 1) {
              const d = e[o],
                c = d.progress,
                p = Math.min(Math.max(c, -4), 4);
              let u = d.swiperSlideOffset;
              t.params.centeredSlides && !t.params.cssMode && (t.wrapperEl.style.transform = `translateX(${t.minTranslate()}px)`), t.params.centeredSlides && t.params.cssMode && (u -= e[0].swiperSlideOffset);
              let m = t.params.cssMode ? -u - t.translate : -u,
                h = 0;
              const f = -100 * Math.abs(p);
              let g = 1,
                v = -i.perSlideRotate * p,
                w = i.perSlideOffset - 0.75 * Math.abs(p);
              const b = t.virtual && t.params.virtual.enabled ? t.virtual.from + o : o,
                y = (b === s || b === s - 1) && p > 0 && p < 1 && (n || t.params.cssMode) && l < r,
                E = (b === s || b === s + 1) && p < 0 && p > -1 && (n || t.params.cssMode) && l > r;
              if (y || E) {
                const e = (1 - Math.abs((Math.abs(p) - 0.5) / 0.5)) ** 0.5;
                (v += -28 * p * e), (g += -0.5 * e), (w += 96 * e), (h = -25 * e * Math.abs(p) + "%");
              }
              if (((m = p < 0 ? `calc(${m}px ${a ? "-" : "+"} (${w * Math.abs(p)}%))` : p > 0 ? `calc(${m}px ${a ? "-" : "+"} (-${w * Math.abs(p)}%))` : `${m}px`), !t.isHorizontal())) {
                const e = h;
                (h = m), (m = e);
              }
              const x = p < 0 ? "" + (1 + (1 - g) * p) : "" + (1 - (1 - g) * p),
                S = `\n        translate3d(${m}, ${h}, ${f}px)\n        rotateZ(${i.rotate ? (a ? -v : v) : 0}deg)\n        scale(${x})\n      `;
              if (i.slideShadows) {
                let e = d.querySelector(".swiper-slide-shadow");
                e || (e = he("cards", d)), e && (e.style.opacity = Math.min(Math.max((Math.abs(p) - 0.5) / 0.5, 0), 1));
              }
              d.style.zIndex = -Math.abs(Math.round(c)) + e.length;
              ue(0, d).style.transform = S;
            }
          },
          setTransition: (e) => {
            const s = t.slides.map((e) => h(e));
            s.forEach((t) => {
              (t.style.transitionDuration = `${e}ms`),
                t.querySelectorAll(".swiper-slide-shadow").forEach((t) => {
                  t.style.transitionDuration = `${e}ms`;
                });
            }),
              me({ swiper: t, duration: e, transformElements: s });
          },
          perspective: () => !0,
          overwriteParams: () => ({ watchSlidesProgress: !0, virtualTranslate: !t.params.cssMode }),
        });
    },
  ];
  return ae.use(fe), ae;
})();
//# sourceMappingURL=swiper-bundle.min.js.map
