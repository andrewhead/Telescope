def([
  "jquery",
  "backbone",
  "underscore",
  "GutterPillView",
], function ($, Backbone, _, GutterPillView) {
  return Backbone.View.extend({
    jsMirror: null,
    sources: null,
    mirrorLastLine: 0,
    activeCodeOnly: true,

    initialize: function (codeMirror, sourceCollection, traceCollection) {
      this.jsMirror = codeMirror;
      this.jsMirror.setOption("lineNumbers", true);
      this.sourceCollection = sourceCollection;
      this.traceCollection = traceCollection;
    },

    showSources: function () {
      this.deleteAllLines();

      var sourceModels = this.sourceCollection.getOrdered();
      _(sourceModels).each(function (sourceModel) {
        if (!sourceModel.isVisible()) {
          return;
        }

        var sourceCode = sourceModel.getCode();
        var mirrorPosition = this.insertLines(sourceCode);
        sourceModel.setMirrorPos(mirrorPosition);

        if (this.activeCodeOnly) {
          this.deleteInactiveLines(sourceModel);
        }

      }, this);

      this.addGutterPills();
      this.scrollTop();
    },

    addGutterPills: function () {
      var functionTraceModels = this.traceCollection.where({type:"function"});
      _(functionTraceModels).each(function (traceModel) {
        var trace = traceModel.toJSON();

        var sourceModel = this.sourceCollection.findWhere({path: trace.path});
        var mirrorPos = sourceModel.getMirrorPos();
        var startLine = mirrorPos.startLine + trace.startLine;

        var pill = new GutterPillView(this.jsMirror, startLine, trace, this.sourceCollection);
        pill.setCount(trace.hits);
      }, this);
    },

    showInactive: function () {
      this.activeCodeOnly = false;
      this.showSources();
    },

    hideInactive: function () {
      this.activeCodeOnly = true;
      this.showSources();
    },

    showSourceModel: function (sourceModel) {
      sourceModel.show();
      this.showSources();
    },

    hideSourceModel: function (sourceModel) {
      sourceModel.hide();
      this.showSources();
    },

    insertLines: function (sourceStr, atLine) {
      var doc = this.jsMirror.getDoc();
      var startLineCount = doc.lineCount() - 1;

      var pos = { // create a new object to avoid mutation of the original selection
        line: atLine || startLineCount,
        ch: -1 // set the character position to the end of the line
      };
      doc.replaceRange(sourceStr + '\n', pos); // adds a new line

      var endLineCount = doc.lineCount() - 1;
      var linesInserted = endLineCount - startLineCount;

      return {
        startLine: pos.line,
        endLine: pos.line + linesInserted
      };
    },

    deleteAllLines: function () {
      var doc = this.jsMirror.getDoc();
      var lastLine = doc.lineCount();
      this.deleteLines(0, lastLine);
    },

    deleteLines: function (startLine, endLine) {
      var doc = this.jsMirror.getDoc();

      var startPos = {
        line: startLine,
        ch: -1
      };
      var endPos = {
        line: endLine + 1,
        ch: -1
      };

      doc.replaceRange("", startPos, endPos);
    },

    deleteInactiveLines: function (sourceModel) {
      var pos = sourceModel.getMirrorPos();
      var activeLines = sourceModel.getActiveLines();
      var allLines = _.range(pos.startLine, pos.endLine); //inclusive, exclusive
      var linesToDelete = _.difference(allLines, activeLines);
      _(linesToDelete).sortBy(function (num) {
        return num
      });

      var ranges = [];
      for (var i = 0; i < linesToDelete.length; i++) {
        var currentNum = linesToDelete[i];
        while (linesToDelete[i + 1] - linesToDelete[i] <= 1) {
          i++;
        }

        ranges.push({
          start: currentNum,
          end: linesToDelete[i]
        });
      }

      //as we delete lines, subtract the line numbers from future ranges
      var lastDiff = 0;
      _(ranges).each(function (range) {
        this.deleteLines(range.start - lastDiff, range.end - lastDiff);

        lastDiff += (range.end - range.start) + 1;
      }, this);

      //update traces with line diffs
      var functionTraceModels = this.traceCollection.where({type:"function"});
      _(functionTraceModels).each(function (traceModel) {
        var startLine = parseInt(traceModel.get("startLine"));
        var endLine = parseInt(traceModel.get("endLine"));

        var lineDiff = this.sumRanges(ranges, startLine);

        traceModel.set("startLine", startLine - lineDiff);
        traceModel.set("endLine", endLine - lineDiff);
      }, this);
    },

    sumRanges: function (ranges, lessThanNum) {
      var sum = 0;

      for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i];
        if (range.start < lessThanNum && range.end < lessThanNum) {
          sum += (range.end - range.start) + 1;
          if(range.start === 0){
            sum += 1;
          }
        } else {
          break;
        }
      }

      return sum;
    },

    scrollToSourceModel: function (sourceModel) {
      var position = sourceModel.getMirrorPos();
      var margin = $(window).height() / 2;
      this.jsMirror.scrollIntoView({line: position.line, ch: 0}, margin);
      this.jsMirror.setCursor({line: position.line});
    },

    scrollTop: function () {
      window.setTimeout(_.bind(function () {
        this.jsMirror.scrollTo({line: 0, ch: 0});
        this.jsMirror.setCursor({line: 0});
      }, this), 1);
    },


  });
})
;