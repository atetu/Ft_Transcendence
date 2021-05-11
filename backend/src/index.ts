import "reflect-metadata";
import { createConnection } from "typeorm";
import * as express from "express";
import * as bodyParser from "body-parser";
import { Request, Response } from "express";
import { User } from "./entities/User";
import * as cors from "cors";
import * as morgan from "morgan";
import * as passport from "passport";
import routes from "./routes";
import * as oauth from "./security/oauth";

const PORT = 3001;

createConnection()
  .then(async (connection) => {
    oauth.install();

    const app = express();

    app.use(morgan("tiny"));
    app.use(cors());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(passport.initialize());
    app.use(routes);

    app.use(function (err, req, res, next) {
      if (err.name === "UnauthorizedError") {
        return res.status(403).send({
          message: "no access token",
        });
      }
    });

    app.listen(PORT);

    console.log(`Started on port ${PORT}`);
  })
  .catch((error) => console.log(error));
