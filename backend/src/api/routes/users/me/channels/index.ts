import * as celebrate from "celebrate";
import * as express from "express";
import Container from "typedi";
import Channel from "../../../../../entities/Channel";
import User from "../../../../../entities/User";
import ChannelService from "../../../../../services/ChannelService";
import ChannelUserService from "../../../../../services/ChannelUserService";
import helpers from "../../../../helpers";
import _id from "./_id";

export default (app: express.Router) => {
  const channelService = Container.get(ChannelService);
  const channelUserService = Container.get(ChannelUserService);

  const route = express.Router();

  app.use("/channels", route);

  route.get("/", async (req, res, next) => {
    const user: User = req.user as any;
    const channels: Channel[] = await channelService.findAllWhereUserIn(user);

    res.status(200).send(channels);
  });

  route.post(
    "/",
    celebrate.celebrate({
      [celebrate.Segments.BODY]: {
        channelId: celebrate.Joi.number().required(),
        password: celebrate.Joi.string().optional(),
      },
    }),
    async (req, res, next) => {
      const { channelId, password } = req.body as {
        channelId: number;
        password: string;
      };

      try {
        const user: User = req.user as any;
        const channel: Channel = await channelService.findById(channelId);

        if (!channel) {
          return helpers.notFound("channel not found");
        }

        const channelUser = await channelUserService.findByChannelAndUser(
          channel,
          user
        );

        if (channelUser) {
          if (channelUser.banned) {
            return helpers.forbidden("banned from channel");
          }

          return helpers.conflict("already in the channel");
        }

        if (channel.isPrivate()) {
          return helpers.forbidden("channel is private");
        }

        if (channel.isProtected() && !(await channel.checkPassword(password))) {
          return helpers.forbidden("wrong password");
        }

        await channelUserService.create(channel, user);

        res.status(200).send(channel);
      } catch (error) {
        next(error);
      }
    }
  );

  _id(route);

  return route;
};
