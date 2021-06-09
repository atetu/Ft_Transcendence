import * as express from "express";
import Container from "typedi";
import UserService from "../../../services/UserService";
import middlewares from "../../middlewares";
import me from "./me";
import _userid from "./_userid";

export default (app: express.Router) => {
  const userService = Container.get(UserService);

  const route = express.Router();

  app.use("/users", route);

  route.get("/", middlewares.authorize(false), async (req, res, next) => {
    const users = await userService.all()

    res.status(200).send(users);
  });

  me(route);
  _userid(route);

  return route;
};
