var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");
require("dotenv").config();

var indexRouter = require("./routes/index");
var ontologyRouter = require("./routes/ontology");
var unifiedRouter = require("./routes/unified");
const ontologyService = require("./services/ontologyService");
const unifiedSearchService = require("./services/unifiedSearchService");
const Logger = require("./utils/logger");

var app = express();

// Cargar la ontología e inicializar servicios al iniciar la aplicación
Promise.all([ontologyService.loadOntology(), unifiedSearchService.init()])
  .then(() => {
    Logger.info("Aplicación iniciada con todos los servicios cargados");
  })
  .catch((error) => {
    Logger.error("Error al cargar servicios al iniciar:", error);
  });

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/api/ontology", ontologyRouter);
app.use("/api/unified", unifiedRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
