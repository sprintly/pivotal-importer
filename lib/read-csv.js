var csv = require('csv');
var fs = require('fs');

module.exports = function(path, cb) {
  fs.readFile(path, function(err, csvData) {
    if (err) {
      return cb(err);
    }

    csv.parse(csvData.toString(), { columns: true }, function(err, data) {
      if (err) {
        return cb(err);
      }

      cb(null, data);
    });
  });
}
