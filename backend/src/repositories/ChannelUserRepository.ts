import { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import Channel from "../entities/Channel";
import ChannelUser from "../entities/ChannelUser";
import User from "../entities/User";

@Service()
@EntityRepository(ChannelUser)
export class ChannelUserRepository extends Repository<ChannelUser> {
  async findByChannelAndUser(channel: Channel, user: User) {
    return await this.findOne({ channel, user });
  }
  async findAllByUserAndNotBannedIncludeChannel(user: User) {
    return await this.find({
      where: {
        user,
        banned: false,
      },
      relations: ["channel"],
    });
  }
}
