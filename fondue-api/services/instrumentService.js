var cheerio = require('cheerio');
var _ = require('underscore');
var URI = require('URIjs');
var request = require("request");
var util = require("../util/util");
var routes = require("../routes/routes");
var fondueService = require("./fondueService");

var blockedDomains = [
  "static.dynamicyield.com",
  "static.chartbeat.com",
  "scorecardresearch.com",
  "connect.facebook.net",
  "google-analytics.com",
  "beacon.krxd.net",
  "trackingTags_v1.1",
  "html5shiv",
  "advertisement",
  "swfobject",
  // "ac-globalnav.built",
  "global/scripts/lib/prototype",
  // "browserdetect",
  "feedstatistics",
  // "search_decorator",
  // "redirect",
  "scriptaculous",
  // "ac-globalfooter.built",
  // "ac_retina",
  // "ac_base",
  // "s_code_h",
  // "apple_core",
  // "sizzle",
  "secure.assets.tumblr.com/languages/strings/en_US",
  "assets/scripts/tumblr/utils/exceptions.js",
  "assets/scripts/vendor/yahoo/rapid/rapidworker",
  "rapidworker-1.2.js",
  "rapid-3.36.1.js",
];


module.exports = {
  getInlineScriptSources: function (url, callback) {
    request({
      url: url,
      method: "GET",
      rejectUnauthorized: false,
      headers: {
        "Cache-Control": "no-cache",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.130 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.8"
      }
    }, function (err, subRes, body) {
      if (err) throw err;

      console.log("Fetching inline scripts for JSBin", url);

      var arrJS = [];
      var $ = cheerio.load(body);
      var scripts = $("script");
      _.each(scripts, function (scriptNode, i) {
        var $scriptEl = $(scriptNode);
        if (!$scriptEl.attr("src")) {
          var src = $scriptEl.html();
          src = util.beautifyJS(src, url);

          arrJS.push({
            order: i,
            js: src
          });
        }
      });

      callback(arrJS);
    });
  },

  instrumentHTML: function (url, basePath, callback) {
    request({
      url: url, method: "GET", rejectUnauthorized: false, headers: {
        "Cache-Control": "no-cache",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.130 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.8"
      }
    }, function (err, subRes, body) {
      if (err) {
        console.log("Error on fetching HTML. Returning \"\" for:", url);
        callback("");
        return;
      }

      body = util.beautifyHTML(body);  //Remove crap that breaks fondue

      var $ = cheerio.load(body);
      var domItems = $("*");
      _(domItems).each(function (domItem) {
        var $domItem = $(domItem);

        if ($domItem.is("script")) {
          var elSrcLink = $domItem.attr("src");
          if (elSrcLink && elSrcLink.indexOf("chrome-extension") < 0) {
            if ($domItem.is("script")) {
              if (elSrcLink && elSrcLink.indexOf("http") < 0) {
                elSrcLink = URI(elSrcLink).absoluteTo(basePath).toString();
              }

              $domItem.attr("src", routes.HOST + routes.INSTRUMENT + "?js=true&url=" + encodeURIComponent(elSrcLink));
            }
          }
        }

      });

      var fondueOptions = {
        path: url,
        include_prefix: false
      };

      var cleanedSrc = $.html();
      fondueService.instrumentHTML(cleanedSrc, fondueOptions, function (src) {
        var $ = cheerio.load(src);
        $("html > head").prepend($("script")[0]);

        var html = $.html();

        callback(html);
      });
    });

  },

  instrumentJS: function (url, basePath, callback) {
    request({
      url: url,
      fileName: basePath,
      method: "GET",
      rejectUnauthorized: false,
      gzip: true
    }, function (err, subRes, body) {
      if (err) {
        console.log("Error on fetching JS. Returning \"\" for:", url);
        callback("");
        return;
      }

      if (_(blockedDomains).find(function (domain) {
          if (url.indexOf(domain) > -1) {
            return true;
          }
        })) {
        console.log("Blocking source request and returning original for:", url);

        callback(body);
        return;
      }

      var fondueOptions = {
        path: url,
        include_prefix: false
      };

      fondueService.instrumentJavaScript(body, fondueOptions, function (src) {
        callback(src);
      });
    });
  }
};