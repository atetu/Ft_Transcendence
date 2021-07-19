import * as express from "express";
import * as celebrate from "celebrate";
import middlewares from "../../middlewares";
import User from "../../../entities/User";
import UserService from "../../../services/UserService";
import { Container } from "typeorm-typedi-extensions";
import helpers from "../../helpers";
import PendingGameService from "../../../services/PendingGameService";
import _id from "./_id";

export default (app: express.Router) => {
  const userService = Container.get(UserService);
  const pendingGameService = Container.get(PendingGameService);

  const route = express.Router();

  app.use("/pending-games", middlewares.authorize(false), route);

  route.post(
    "/",
    celebrate.celebrate(
      {
        [celebrate.Segments.BODY]: {
          peerId: celebrate.Joi.number().required(),
          map: celebrate.Joi.number().required(),
          ballVelocity: celebrate.Joi.number().required(),
          paddleVelocity: celebrate.Joi.number().required(),
        },
      },
      {
        abortEarly: false,
      }
    ),
    async (req, res, next) => {
      const user: User = req.user as any;
      const { peerId, map, ballVelocity, paddleVelocity } = req.body as {
        peerId: number;
        map: number;
        ballVelocity: number;
        paddleVelocity: number;
      };
      console.log('inside index')
      console.log(map)
      console.log(ballVelocity)
      console.log(paddleVelocity)
      try {
        const peer = await userService.findById(peerId);

        if (!peer) {
          return helpers.notFound(`peer not found`);
        }

        const pendingGame = await pendingGameService.create(user, peer, map, ballVelocity, paddleVelocity);

        res.status(200).send(pendingGame.toJSON());
      } catch (error) {
        next(error);
      }
    }
  );

  _id(route);

  return route;
};
