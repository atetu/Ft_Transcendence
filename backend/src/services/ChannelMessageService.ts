import { Inject, Service, Container } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import Channel from "../entities/Channel";
import ChannelMessage from "../entities/ChannelMessage";
import ChannelMessageRepository from "../repositories/ChannelMessageRepository";
import SocketService from "../services/SocketService";
import ChannelService from "../services/ChannelService";
import UserService from "../services/UserService";

@Service()
export default class ChannelMessageService {
  constructor(
    @InjectRepository()
    private repository: ChannelMessageRepository,

    @Inject()
    private socketService: SocketService
  ) {
    // setInterval(async () => {
    //   const channel = await Container.get(ChannelService).findById(1);
    //   const user = await Container.get(UserService).findById(1);

    //   const message = new ChannelMessage();
    //   message.channel = channel
    //   message.user = user
    //   message.content = "Hello: " + Date.now()

    //   this.create(message);
    // }, 1000);
  }

  public async all() {
    return await this.repository.find();
  }

  public async allByChannel(channel: Channel) {
    return await this.repository.find({ channel });
  }

  public async create(message: ChannelMessage) {
    await this.repository.save(message);

    this.socketService.broadcastMessage(message);

    return message;
  }
}