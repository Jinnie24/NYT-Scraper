var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var path = require("path");
var exphbs = require("express-handlebars");

var Note = require("./models/Note.js");
var Article = require("./models/Article.js");

var request = require("request");
var cheerio = require("cheerio");

mongoose.Promise = Promise;
var port = process.env.PORT || 3000

var app = express();

app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(express.static("public"));
app.engine("handlebars", exphbs({
    defaultLayout: "main",
    partialsDir: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "handlebars");


mongoose.connect("mongodb://localhost/indira");
var db = mongoose.connection;

db.on("error", function(error) {
  console.log("Mongoose Error: ", error);
});
db.once("open", function() {
  console.log("Mongoose connection successful.");
});


app.get("/", function(req, res) {
  Article.find({"saved": false}, null, {sort: {created: -1}})
    .limit(20)
    .then(function(data) {
      var hbsObject = {
        article: data
      };
      res.render("home", hbsObject);
    });
});

app.get("/saved", function(req, res) {
  Article.find({"saved": true}).populate("notes").exec(function(error, articles) {
    var hbsObject = {
      article: articles
    };
    res.render("saved", hbsObject);
  });
});

app.get("/scrape", function(req, res) {
  request("https://www.nytimes.com/section/world", function(error, response, html) {
		var $ = cheerio.load(html);
		var result = {};
		$("div.story-body").each(function(i, element) {
			var link = $(element).find("a").attr("href");
			var title = $(element).find("h2.headline").text().trim();
			var summary = $(element).find("p.summary").text().trim();
			result.link = link;
			result.title = title;
			if (summary) {
				result.summary = summary;
			};
			
			var entry = new Article(result);
			entry.save(function(err, doc) {
        if (err) {
          console.log(err);
        }
      });

    });
        res.send("Scrape complete fine");
	});

});

app.get("/articles", function(req, res) {
Article.find({}, function(error, doc) {
    if (error) {
      console.log(error);
    }
  });
});

app.get("/articles/:id", function(req, res) {
  Article.findOne({ "_id": req.params.id })
  .populate("note")
  .exec(function(error, doc) {
    if (error) {
      console.log(error);
    } else {
      res.json(doc);
    }
  });
});

app.post("/articles/save/:id", function(req, res) {
      Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true})
      .exec(function(err, doc) {
       if (err) {
          console.log(err);
        } else {
          res.send(doc);
        }
      });
});

app.post("/articles/delete/:id", function(req, res) {
      Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "notes": []})
     .exec(function(err, doc) {
       if (err) {
          console.log(err);
        } else {
          res.send(doc);
        }
      });
});

app.post("/notes/save/:id", function(req, res) {
  var newNote = new Note({
    body: req.body.text,
    article: req.params.id
  });
  console.log(req.body)
  newNote.save(function(error, note) {
    if (error) {
      console.log(error);
    } else {
     Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "notes": note } })
     .exec(function(err) {
        if (err) {
          console.log(err);
          res.send(err);
        } else {
          res.send(note);
        }
      });
    }
  });
});

app.delete("/notes/delete/:note_id/:article_id", function(req, res) {
  Note.findOneAndRemove({ "_id": req.params.note_id }, function(err) {
    if (err) {
      console.log(err);
      res.send(err);
    } else {
      Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"notes": req.params.note_id}})
        .exec(function(err) {
          if (err) {
            console.log(err);
            res.send(err);
          } else {
            res.send("Note Sucsessfully Deleted");
          }
        });
    }
  });
});

app.listen(port, function() {
  console.log("App running on port " + port);
});

