const HYPNOGRAM_CHART = function (selector, data) {
  this.ELEMENT = $(selector);
  this.DATA = data;
  this.yAxisLabels = {wake: 'wake', rem: 'rem', light: 'light', deep: 'deep'};
  this.tooltipClassName = 'hypnogram-chart-tooltip';
  this.selectedSegment = null;
  this.tooltipLocation = null;
};

HYPNOGRAM_CHART.prototype.renderChart = function renderChart() {
  var $element = this.ELEMENT;
  var data = this.DATA;
  var _this = this;

  // Append tooltip
  $element.append($('<div class="' + this.tooltipClassName + '"></div>'));

  var dateOfSleep = data.sleep[0].dateOfSleep,
    duration = data.sleep[0].duration,
    efficiency = data.sleep[0].efficiency,
    isMainSleep = data.sleep[0].isMainSleep,
    shortLevelsData = data.sleep[0].levels.shortData,
    levelsData = data.sleep[0].levels.data,
    logId = data.sleep[0].logId,
    minutesAfterWakeup = data.sleep[0].minutesAfterWakeup,
    minutesAsleep = data.sleep[0].minutesAsleep,
    minutesAwake = data.sleep[0].minutesAwake,
    minutesToFallAsleep = data.sleep[0].minutesToFallAsleep,
    startTime = data.sleep[0].startTime,
    type = data.sleep[0].type;

  if ($element && $element.length) {
    this.initChart({
      target: $element[0],
      chartData: {
        dateOfSleep: dateOfSleep,
        duration: duration,
        efficiency: efficiency,
        isMainSleep: isMainSleep,
        levelsData: levelsData,
        shortLevelsData: shortLevelsData,
        logId: logId,
        minutesAfterWakeup: minutesAfterWakeup,
        minutesAsleep: minutesAsleep,
        minutesAwake: minutesAwake,
        minutesToFallAsleep: minutesToFallAsleep,
        // Using moment to get the correct date object.
        // Firefox and Chrome treat a the ISO 8601 format differently.
        // Without the 'Z', Chrome treats the time as UTC while Firefox treats it as local.
        // Moment normalizes.
        startTime: moment(startTime).toDate(),
        type: type
      }
    });
  }

  // Event show/hide tooltip
  d3.select($element[0]).on('touchmove', function(event) {
    _this.showTooltip(event);
  }).on('mousemove', function(event) {
    _this.showTooltip(event);
  }).on('touchend', function() {
    _this.hideTooltip();
  }).on('mouseleave', function() {
    _this.hideTooltip();
  });
}

HYPNOGRAM_CHART.prototype.initChart = function initChart(options) {
  this.chartAspectRatio = 0.3;
  this.segmentHeight = 10;
  this.margin = {
    left: 70,
    top: 30,
    right: 15,
    bottom: 50
  };
  this.target = '#chart';
  this.highlightedStage = 'all';
  this.levelColors = ['rgb(247,56,110)', 'rgb(124,196,255)', 'rgb(58,135,255)', 'rgb(15,72,169)']; // override defaults

  for (var key in options) {
    if (options.hasOwnProperty(key)) {
      this[key] = options[key];
    }
  }

  this.setDimensions();
  this.createChart();
  this.bindEvents();
  this.fetchData(options.chartData);
}

HYPNOGRAM_CHART.prototype.bindEvents = function bindEvents() {// window.addEventListener("resize", debounce(this.handleResize.bind(this), 500));
  // d3.selectAll('.hypnogram-trigger').on('click', function(){
  //     var stage = d3.event.currentTarget.dataset.stage;
  //     this.highlightSegment(stage);
  // }.bind(this));
},

HYPNOGRAM_CHART.prototype.setDimensions = function setDimensions() {
  var target = this.target,
      margin = this.margin,
      chartAspectRatio = this.chartAspectRatio;
  var nodeWidth = d3.select(target).node().getBoundingClientRect().width;
  var width = this.width = nodeWidth - margin.left - margin.right;

  if (nodeWidth <= 320) {
    chartAspectRatio = 0.7;
  } else if (nodeWidth <= 640) {
    chartAspectRatio = 0.5;
  } else {
    chartAspectRatio = 0.3;
  }

  this.chartAspectRatio = chartAspectRatio;
  var height = this.height = chartAspectRatio * width - margin.bottom - margin.top;

  if (height < 100) {
    this.segmentHeight = 5;
  } else {
    this.segmentHeight = 10;
  }
}

HYPNOGRAM_CHART.prototype.fetchData = function fetchData(data) {
  this.startTime = new Date(data.startTime);
  this.hypnogramData = this.getFormattedData(data.levelsData);
  this.shortWakeData = this.getFormattedShortWakeData(data.shortLevelsData);
  this.setScales();
  this.setFurniture();
  this.renderHypnogram();
}

HYPNOGRAM_CHART.prototype.setFurniture = function setFurniture() {
  var _this3 = this;

  var yAxisLabels = this.yAxisLabels;
  this.segmentPath = d3.line().y(function (d) {
    return d[1] + _this3.segmentHeight / 2;
  });
  this.xAxisGenerator = d3.axisBottom().scale(this.xScale).tickFormat(d3.timeFormat('%-I:%M')).tickSizeOuter(0);
  this.yAxisGenerator = d3.axisLeft().scale(this.yScale).tickFormat(function (d) {
    return yAxisLabels[d].toUpperCase();
  });
}

// this is based on sample data from IPD
HYPNOGRAM_CHART.prototype.getFormattedData = function getFormattedData(data) {
  var scaleY = {
    wake: 0,
    rem: 1,
    light: 2,
    deep: 3
  }; // Filter out data with unknown levels.

  return data.filter(function (d) {
    return scaleY.hasOwnProperty(d.level);
  }).map(function (d) {
    var obj = {
      start: moment(d.dateTime),
      end: moment(d.dateTime).add(d.seconds, 'seconds'),
      level: d.level,
      row: scaleY[d.level]
    };
    return obj;
  });
}

HYPNOGRAM_CHART.prototype.getFormattedShortWakeData = function getFormattedShortWakeData(data) {
  return data.map(function (d) {
    var start = moment(d.dateTime);
    var end = start.clone();
    end.add(d.seconds, 'seconds');
    return {
      start: start,
      end: end,
      level: 'wake',
      row: 0
    };
  });
}

HYPNOGRAM_CHART.prototype.setScales = function setScales() {
  var data = this.hypnogramData,
      height = this.height,
      width = this.width;
  var extent = data && data.length ? [data[0].start, data[data.length - 1].end] : [];
  this.xScale = d3.scaleTime().domain(extent).range([0, width]);
  this.yScale = d3.scaleOrdinal().domain(['wake', 'rem', 'light', 'deep']).range([0, height * 0.3, height * 0.6, height * 0.9]);
}

HYPNOGRAM_CHART.prototype.createChart = function createChart() {
  var target = this.target,
      width = this.width,
      margin = this.margin,
      height = this.height;
  this.svg = d3.select(target).append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom).append('g').attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')');
}

HYPNOGRAM_CHART.prototype.getScaledPoints = function getScaledPoints() {
  var _this4 = this;

  var points = [];
  this.hypnogramData.forEach(function (d) {
    points.push([_this4.xScale(d.start), _this4.yScale(d.level)]);
    points.push([_this4.xScale(d.end), _this4.yScale(d.level)]);
  });
  return points;
}

HYPNOGRAM_CHART.prototype.getRadius = function getRadius(width) {
  var segmentHeight = this.segmentHeight;

  if (width < segmentHeight) {
    // hardcoding, blerg
    return 2;
  } else {
    return segmentHeight / 2;
  }
}

HYPNOGRAM_CHART.prototype.getStartJoint = function getStartJoint(d, i, isCap) {
  var data = this.hypnogramData,
      segmentHeight = this.segmentHeight;
  var w = this.xScale(d.end) - this.xScale(d.start),
      r = this.getRadius(w); // if its the start or previous segment is lower

  if (i > 0 && data[i - 1].row > d.row || isCap === true) {
    return this.getSegmentJoint(this.xScale(d.start), this.yScale(d.level) + segmentHeight, r, 'topLeft');
  } // // if its last or previous is higher


  if (i > 0 && i < data.length - 1 && data[i - 1].row < d.row) {
    return this.getSegmentJoint(this.xScale(d.start), this.yScale(d.level), r, 'bottomLeft');
  }
}

HYPNOGRAM_CHART.prototype.getEndJoint = function getEndJoint(d, i, isCap) {
  var data = this.hypnogramData,
      segmentHeight = this.segmentHeight;
  var w, r;

  if (i === data.length - 1) {
    return 'm 0 0';
  } // }


  w = this.xScale(d.end) - this.xScale(d.start) + 1;
  r = this.getRadius(w); // if its last or next segment is lower

  if (i === data.length - 1 || i < data.length - 1 && data[i + 1].row > d.row || isCap === true) {
    return this.getSegmentJoint(this.xScale(d.end), this.yScale(d.level) + segmentHeight, r, 'topRight');
  } // // if its first or next segment is higher


  if (i > 0 && data[i + 1].row < d.row) {
    return this.getSegmentJoint(this.xScale(d.end), this.yScale(d.level), r, 'bottomRight');
  }
}

HYPNOGRAM_CHART.prototype.getBodyJoint = function getBodyJoint(d, i, isDisconnected, isCap) {
  var height = this.height,
      segmentHeight = this.segmentHeight,
      margin = this.margin,
      data = this.hypnogramData;
  var x = this.xScale(d.start) - 0.5,
      y = this.yScale(d.level),
      w = this.xScale(d.end) - this.xScale(d.start) + 1,
      h = isDisconnected && isCap !== true ? height + margin.top + margin.bottom : segmentHeight,
      r = this.getRadius(w),
      tl,
      tr,
      bl,
      br;
  x = isDisconnected ? x + 0.5 : x;
  w = isDisconnected ? w - 1 : w; // if its the start or previous segment is lower

  if (i === 0 || i > 0 && data[i - 1].row > d.row || isDisconnected === true) {
    tl = r;
  } else {
    tl = 0;
  } // if its last or next segment is lower


  if (i === data.length - 1 || i < data.length - 1 && data[i + 1].row > d.row || isDisconnected === true) {
    tr = r;
  } else {
    tr = 0;
  } // if its first or previous segment is higher


  if ((i === 0 || i > 0 && data[i - 1].row < d.row) && isCap === false) {
    bl = r;
  } else {
    bl = 0;
  } // if its last or next segment is higher


  if ((i === data.length - 1 || i < data.length - 1 && data[i + 1].row < d.row) && isCap === false) {
    br = r;
  } else {
    br = 0;
  }

  return this.getRoundedRectangle(x, y, w, h, r, tl, tr, bl, br, false);
}

HYPNOGRAM_CHART.prototype.getRoundedRectangle = function getRoundedRectangle(x, y, w, h, r, tl, tr, bl, br, isClosed) {
  var rectangle = ["M ".concat(x + r, ", ").concat(y)];
  rectangle.push("h ".concat(w - 2 * r));

  if (tr) {
    rectangle.push("a ".concat(r, ",").concat(r, " 0 0 1 ").concat(r, ",").concat(r));
  } else {
    rectangle.push("h ".concat(r));
    rectangle.push("v ".concat(r));
  }

  rectangle.push("v ".concat(h - 2 * r));

  if (br) {
    rectangle.push("a ".concat(r, ", ").concat(r, " 0 0 1 -").concat(r, ",").concat(r));
  } else {
    rectangle.push("v ".concat(r));
    rectangle.push("h -".concat(r));
  }

  rectangle.push("h ".concat(2 * r - w));

  if (bl) {
    rectangle.push("a ".concat(r, ", ").concat(r, " 0 0 1 -").concat(r, ",-").concat(r));
  } else {
    rectangle.push("h -".concat(r));
    rectangle.push("v -".concat(r));
  }

  rectangle.push("v ".concat(2 * r - h));

  if (tl) {
    rectangle.push("a ".concat(r, ", ").concat(r, " 0 0 1 ").concat(r, ", -").concat(r));
  } else {
    rectangle.push("v -".concat(r));
    rectangle.push("h ".concat(r));
  }

  if (isClosed) {
    rectangle.push('z');
  }

  return rectangle.join(' ');
}

HYPNOGRAM_CHART.prototype.getSegmentJoint = function getSegmentJoint(x, y, radius, orientation, isClosed) {
  var joint = ["M ".concat(x, ",").concat(y)];

  switch (orientation) {
    case 'bottomRight':
      joint.push("l 0,-".concat(radius));
      joint.push("a -".concat(radius, ",-").concat(radius, " 0 0 1 -").concat(radius, ",").concat(radius));
      joint.push("l -".concat(radius, ",0"));
      break;

    case 'bottomLeft':
      joint.push("l ".concat(radius, ", 0"));
      joint.push("a -".concat(radius, ",-").concat(radius, " 0 0 1 -").concat(radius, ",-").concat(radius));
      joint.push("l 0,-".concat(radius));
      break;

    case 'topLeft':
      joint.push("l ".concat(radius, ", 0"));
      joint.push("a -".concat(radius, ",-").concat(radius, " 0 0 0 -").concat(radius, ",").concat(radius));
      joint.push("l 0,-".concat(radius));
      break;

    case 'topRight':
      joint.push("l -".concat(radius, ", 0"));
      joint.push("a ".concat(radius, ",").concat(radius, " 0 0 1 ").concat(radius, ",").concat(radius));
      joint.push("l 0,".concat(radius));
      break;
  }

  if (isClosed) {
    joint.push('z');
  }

  return joint.join(' ');
}

HYPNOGRAM_CHART.prototype.getHypnoGramPath = function getHypnoGramPath() {
  var _this5 = this;

  var pts = [],
      start,
      body,
      end;
  this.hypnogramData.forEach(function (d, i) {
    start = _this5.getStartJoint(d, i);
    body = _this5.getBodyJoint(d, i, false, false);
    end = _this5.getEndJoint(d, i);
    pts.push(start, body, end);
  });
  return pts.join(' ');
}

HYPNOGRAM_CHART.prototype.getHypnoGramSegment = function getHypnoGramSegment(d, i) {
  return "".concat(this.getBodyJoint(d, i, true, false), " z");
}

HYPNOGRAM_CHART.prototype.getHypnoGramCap = function getHypnoGramCap(d, i) {
  var pts = [],
      start,
      body,
      end;
  start = this.getStartJoint(d, i, true);
  body = this.getBodyJoint(d, i, true, true);
  end = this.getEndJoint(d, i, true);
  pts.push(start, body, end);
  return pts.join(' ') + ' z';
}

HYPNOGRAM_CHART.prototype.getHypnoShortWake = function getHypnoShortWake(d) {
  var x = this.xScale(d.start);
  var y = this.yScale('wake');
  var w = this.xScale(d.end) - this.xScale(d.start);
  var h = this.segmentHeight;
  return this.getRoundedRectangle(x, y, w, h, Math.min(w, h) / 2, 1, 1, 1, 1, true);
}

HYPNOGRAM_CHART.prototype.update = function update() {
  this.xAxis.call(this.xAxisGenerator);
  this.hypnoGramPath.attr('d', this.segmentPath(this.getScaledPoints()));
  this.hypnoGramShape.attr('d', this.getHypnoGramPath());
}

HYPNOGRAM_CHART.prototype.renderHypnogram = function renderHypnogram() {
  var _this6 = this;

  var svg = this.svg,
      width = this.width,
      height = this.height,
      segmentHeight = this.segmentHeight;
  var defs = svg.append('defs');
  this.clip = defs.append('clipPath').attr('id', 'hypnogram-segment-clip').append('rect').attr('width', width).attr('height', height + segmentHeight * 2).attr('transform', 'translate(0, 0)'); // gradient for main segments

  var gradient = defs.append('linearGradient').attr('id', 'stages-gradient').attr('x1', '0%').attr('y1', '0%').attr('x2', '0').attr('y2', '100%');
  gradient.append('stop').attr('offset', '0%').attr('stop-color', this.getColor('wake')).attr('stop-opacity', 1);
  gradient.append('stop').attr('offset', '30%').attr('stop-color', this.getColor('rem')).attr('stop-opacity', 1);
  gradient.append('stop').attr('offset', '60%').attr('stop-color', this.getColor('light')).attr('stop-opacity', 1);
  gradient.append('stop').attr('offset', '90%').attr('stop-color', this.getColor('deep')).attr('stop-opacity', 1);
  this.hypnoGramSegments = svg.selectAll('hypnogram-segment').data(this.hypnogramData).enter().append('path').attr('class', 'hypnogram-segment').attr('d', function (d, i) {
    return _this6.getHypnoGramSegment(d, i);
  }).attr('clip-path', 'url(#hypnogram-segment-clip)').style('fill', function (d) {
    var color = d3.color(_this6.getColor(d.level));
    color.opacity = 0.75;
    return color;
  }).classed('active-stage', function (d) {
    return d.level === _this6.highlightedStage;
  });
  this.hypnoGramSegmentCaps = this.svg.selectAll('hypnogram-segment-caps').data(this.hypnogramData).enter().append('path').attr('class', 'hypnogram-segment-cap').attr('d', function (d, i) {
    return this.getHypnoGramCap(d, i);
  }.bind(this)).style('fill', function (d) {
    return this.getColor(d.level);
  }.bind(this)).classed('active-stage', function (d) {
    return d.level === this.highlightedStage;
  }.bind(this)); // base path

  this.hypnoGramPath = this.svg.append('path').attr('class', 'hypnogram-path').attr('d', this.segmentPath(this.getScaledPoints())).style('stroke', 'url(#stages-gradient)'); // actual hypnogram

  this.hypnoGramShape = this.svg.append('path').attr('class', 'hypnogram').attr('d', this.getHypnoGramPath()).style('fill', 'url(#stages-gradient)'); // short wakes

  this.shortWakes = this.svg.selectAll('hypnogram-short-wakes').data(this.shortWakeData).enter().append('path').attr('class', 'hypnogram-short-wake').attr('d', function (d, i) {
    return _this6.getHypnoShortWake(d, i);
  });
  this.xAxis = this.svg.append('g').attr('class', 'axis-x').attr('transform', "translate(0, ".concat(this.height + this.segmentHeight * 2, ")")).call(this.xAxisGenerator);
  this.yAxis = this.svg.append('g').attr('class', 'axis-y').attr('transform', 'translate(-10, 4)').call(this.yAxisGenerator);
}

HYPNOGRAM_CHART.prototype.getColor = function getColor(level) {
  var levelColors = this.levelColors;

  if (level === 'wake') {
    return levelColors[0];
  }

  if (level === 'rem') {
    return levelColors[1];
  }

  if (level === 'light') {
    return levelColors[2];
  }

  if (level === 'deep') {
    return levelColors[3];
  }
}

// assumes you've called setDimensions first, otherwise new dimensions wont be reflected
HYPNOGRAM_CHART.prototype.updateChart = function updateChart() {
  var _this7 = this;

  var width = this.width,
      height = this.height,
      svg = this.svg,
      margin = this.margin,
      segmentHeight = this.segmentHeight;
  this.xScale.range([0, width]);
  this.yScale.range([0, height * 0.3, height * 0.6, height * 0.9]); // update the actual svg node

  d3.select(svg.node().parentNode).attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom); // acutally the g/group node

  this.svg.attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')'); // redraw the axis because scale values changed

  this.xAxis.attr('transform', "translate(0, ".concat(height + segmentHeight * 2, ")")).call(this.xAxisGenerator);
  this.yAxis.call(this.yAxisGenerator); // redraw clipping mask

  this.clip.attr('width', width).attr('height', height + segmentHeight * 2); // redraw highlight segments

  this.hypnoGramSegments.attr('d', function (d, i) {
    return _this7.getHypnoGramSegment(d, i);
  }).attr('clip-path', 'url(#hypnogram-segment-clip)');
  this.hypnoGramSegmentCaps.attr('d', function (d, i) {
    return _this7.getHypnoGramCap(d, i);
  }); // redraw points on path

  this.hypnoGramPath.attr('d', this.segmentPath(this.getScaledPoints())); // redraw points on shape

  this.hypnoGramShape.attr('d', this.getHypnoGramPath()); // redraw short wake segments

  this.shortWakes.attr('d', function (d, i) {
    return _this7.getHypnoShortWake(d, i);
  });
}

HYPNOGRAM_CHART.prototype.hideTooltip = function hideTooltip() {
  this.selectedSegment = null;
  this.tooltipLocation = null;
  $('.' + this.tooltipClassName).css('visibility', 'hidden');
}

HYPNOGRAM_CHART.prototype.showTooltip = function showTooltip(event) {
  var element = this.ELEMENT[0];
  var _this = this;
  var pageX = null;

  if (event.pageX)
    pageX = event.pageX;
  else
    pageX = event.changedTouches[0].pageX;

  var xCoord = pageX - element.offsetLeft - this.margin.left;
  var segments = this.shortWakeData.concat(this.hypnogramData);
  
  segments.some(function (segment) {
    if (xCoord > _this.xScale(segment.start) && xCoord < _this.xScale(segment.end)) {
      _this.tooltipLocation = {
          x: pageX,
          y: element.offsetTop + _this.margin.top
        }
      _this.selectedSegment = segment;

      return true;
    }
  });

  this.appendDataTooltip();

  $('.' + this.tooltipClassName).css('left', this.tooltipLocation.x - 8);
  $('.' + this.tooltipClassName).css('top', 15);
  $('.' + this.tooltipClassName).css('visibility', 'visible');
}

HYPNOGRAM_CHART.prototype.appendDataTooltip = function appendDataTooltip() {
  var periodTimeMilliseconds = moment.duration(this.selectedSegment.end.diff(this.selectedSegment.start));
  var periodTimeMinuteSecond = '';

  if (periodTimeMilliseconds.minutes() != 0)
    periodTimeMinuteSecond += periodTimeMilliseconds.minutes() + ' min';
  if (periodTimeMilliseconds.seconds() != 0) {
    if (periodTimeMinuteSecond != '') periodTimeMinuteSecond += ' ';
    periodTimeMinuteSecond += periodTimeMilliseconds.seconds() + ' sec';
  }

  $('.' + this.tooltipClassName).html(
    '<span class="tooltip-label">' +
      this.selectedSegment.level.toUpperCase() +
    '</span> ' +
    '<span class="tooltip-label">' +
      periodTimeMinuteSecond +
    '</span>' +
    '<br>' +
    '<span>' +
      this.selectedSegment.start.format('h:mm:ss') + ' - ' + this.selectedSegment.end.format('h:mm:ss') +
    '</span>'
  );
}

/**
 * Currently unused, but it is expected to be for highlighting segments of the chart in the near future.
 * @param stageToHighlight
 */
 HYPNOGRAM_CHART.prototype.highlightSegment = function highlightSegment(stageToHighlight) {
  this.highlightedStage = stageToHighlight;
  this.hypnoGramShape.classed('hide-hypnogram', stageToHighlight !== 'all');
  this.hypnoGramPath.classed('hide-hypnogram', stageToHighlight !== 'all');
  this.hypnoGramSegments.classed('active-stage', function (d) {
    return d.level === stageToHighlight;
  });
  this.hypnoGramSegmentCaps.classed('active-stage', function (d) {
    return d.level === stageToHighlight;
  });
}

HYPNOGRAM_CHART.prototype._handleResize = function _handleResize() {
  // update dimensions of svg
  this.setDimensions();
  this.updateChart();
  this.hypnoGramPath.attr('d', this.segmentPath(this.getScaledPoints()));
  this.hypnoGramShape.attr('d', this.getHypnoGramPath());
  this.xAxis.call(this.xAxisGenerator);
  this.yAxis.call(this.yAxisGenerator);
}

HYPNOGRAM_CHART.prototype.removeChart = function removeChart() {
  var svg = Ember.get(this, 'svg');

  if (svg) {
    d3.select(svg.node().parentNode).remove();
    Ember.set(this, 'svg', null);
  }
}



var hypnogramChart = new HYPNOGRAM_CHART('.sleep-hypnogram-chart', DATA);
hypnogramChart.renderChart();
