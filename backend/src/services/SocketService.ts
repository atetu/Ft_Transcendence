import * as socketio from "socket.io";
import { Socket } from "socket.io";
import Container, { Service } from "typedi";
import { isObject } from "util";
import AchievementProgress from "../entities/AchievementProgress";
import Channel from "../entities/Channel";
import ChannelMessage from "../entities/ChannelMessage";
import ChannelUser from "../entities/ChannelUser";
import Relationship from "../entities/Relationship";
import User from "../entities/User";
import Game from "../game/Game";
import ChannelService from "./ChannelService";
import GameService from "./GameService";

export type Callback = (err: Error, answer: any) => void;

export enum ClientEvent {
  CONNECTED_JOIN = "client_connected_join",
  CONNECTED_QUIT = "client_connected_quit",
  CONNECTED_LIST = "client_connected_list",
}

export enum ChannelEvent {
  CONNECT = "channel_connect",
  DISCONNECT = "channel_disconnect",
  UPDATE = "channel_update",
  DELETE = "channel_delete",
  MESSAGE = "channel_message",
  EDIT_MESSAGE = "edit_message",
  MESSAGE_DELETE = "channel_message_delete",
  MESSAGE_DELETE_ALL = "channel_message_delete_all",
  USER_JOIN = "channel_user_join",
  USER_LEAVE = "channel_user_leave",
  USER_UPDATE = "channel_user_update",
  OWNER_TRANSFER = "channel_owner_transfer",
  NEW = "channel_new",
  ADD = "channel_add",
}

export enum DirectMessageEvent {
  ADD = "direct_message_add",
}

export enum GameEvent {
  CONNECT = "game_connect",
  MOVE = "game_move",
  STARTING = "game_starting",
}

export enum MatchMakingEvent {
  WAITING_ROOM_JOIN = "waiting_room_join",
  WAITING_ROOM_LEAVE = "waiting_room_leave",
}

export enum UserEvent {
  RELATIONSHIP_NEW = "relationship_new",
  RELATIONSHIP_UPDATE = "relationship_update",
  RELATIONSHIP_DELETE = "relationship_delete",
}

export enum AchievementEvent {
  UNLOCK = "achievement_unlock",
}

export type Event =
  | ClientEvent
  | ChannelEvent
  | DirectMessageEvent
  | GameEvent
  | UserEvent
  | AchievementEvent;

@Service()
export default class SocketService {
  private gameService = Container.get(GameService);
  private get matchMakingService(): any {
    return Container.get(require("./MatchMakingService").default);
  }
  private channelService = Container.get(ChannelService);

  get io() {
    return Container.get(socketio.Server);
  }

  connectedUserSessionCounts: { [key: number]: number } = {};

  get connectedUserIds() {
    return Object.keys(this.connectedUserSessionCounts);
  }

  onConnect(socket: Socket) {
    const { user } = socket.data as { user: User };
    const { id } = user;

    if (this.connectedUserSessionCounts[id]) {
      this.connectedUserSessionCounts[id] += 1;
    } else {
      socket.broadcast.emit(ClientEvent.CONNECTED_JOIN, id);

      this.connectedUserSessionCounts[id] = 1;
    }

    socket.emit(ClientEvent.CONNECTED_LIST, this.connectedUserIds);

    socket.join(user.toRoom());
  }

  onDisconnect(socket: any) {
    const { id } = socket.data.user;

    if (this.connectedUserSessionCounts[id]) {
      const now = (this.connectedUserSessionCounts[id] -= 1);

      if (now === 0) {
        socket.broadcast.emit(ClientEvent.CONNECTED_QUIT, id);

        delete this.connectedUserSessionCounts[id];
      }
    }

    this.matchMakingService.remove(socket);
  }

  async askChannelConnect(socket: Socket, body: any, callback: Callback) {
    const { currentChannelRoom } = socket.data;

    try {
      this.ensureBody(body);

      const { channelId } = body;

      const channel = await this.channelService.findById(channelId);

      if (!channel) {
        throw new Error("channel not found");
      }

      if (currentChannelRoom !== undefined) {
        socket.leave(currentChannelRoom);
      }

      const newChannelRoom = channel.toRoom();

      socket.join(newChannelRoom);
      socket.data.currentChannelRoom = newChannelRoom;

      callback(null, 1);
    } catch (error) {
      callback(error, null);
    }
  }

  askChannelDisconnect(socket: Socket) {
    const { currentChannelRoom } = socket.data;

    if (currentChannelRoom !== undefined) {
      socket.leave(currentChannelRoom);
    }

    delete socket.data.currentChannelRoom;
  }

  public broadcastChannelUpdate(channel: Channel, users: Array<User>) {
    this.broadcastToChannel(channel, ChannelEvent.UPDATE, channel);
    this.broadcastToUsers(users, ChannelEvent.UPDATE, channel);
  }

  public broadcastChannelDelete(channel: Channel) {
    this.broadcastToChannel(channel, ChannelEvent.DELETE, channel);
  }

  public broadcastChannelMessage(message: ChannelMessage) {
    const channel = message.channel;

    this.broadcastToChannel(channel, ChannelEvent.MESSAGE, message);
  }

  public broadcastChannelEditMessage(message: ChannelMessage) {
    const channel = message.channel;

    this.broadcastToChannel(channel, ChannelEvent.EDIT_MESSAGE, message);
  }
  
  public broadcastChannelMessageDelete(message: ChannelMessage) {
    const channel = message.channel;

    this.broadcastToChannel(channel, ChannelEvent.MESSAGE_DELETE, message);
  }

  public broadcastChannelMessageDeleteAll(channel: Channel) {
    this.broadcastToChannel(channel, ChannelEvent.MESSAGE_DELETE_ALL, channel);
  }

  public broadcastChannelUserJoin(channelUser: ChannelUser) {
    const channel = channelUser.channel;

    this.broadcastToChannel(channel, ChannelEvent.USER_JOIN, channelUser);
  }

  public broadcastChannelUserLeave(channelUser: ChannelUser) {
    const channel = channelUser.channel;

    this.broadcastToChannel(channel, ChannelEvent.USER_LEAVE, channelUser);
  }

  public broadcastChannelUserUpdate(channelUser: ChannelUser) {
    const channel = channelUser.channel;

    this.broadcastToChannel(channel, ChannelEvent.USER_UPDATE, channelUser);
  }

  public broadcastChannelOwnerTransfer(channel: Channel) {
    this.broadcastToChannel(
      channel,
      ChannelEvent.OWNER_TRANSFER,
      channel.owner
    );
  }

  public broadcastUserRelationshipNew(relationship: Relationship) {
    this.broadcastToUser(
      relationship.user,
      UserEvent.RELATIONSHIP_NEW,
      relationship
    );
  }

  public broadcastUserRelationshipUpdate(relationship: Relationship) {
    this.broadcastToUser(
      relationship.user,
      UserEvent.RELATIONSHIP_UPDATE,
      relationship
    );
  }

  public broadcastUserRelationshipDelete(user: User, peer: User) {
    this.broadcastToUser(user, UserEvent.RELATIONSHIP_DELETE, peer);
  }

  public broadcastNewChannel(channel: Channel) {
    // TODO need rework, like only for publics?
    this.io.emit(ChannelEvent.NEW, channel.toJSON());
  }

  public notifyAdded(user: User, channel: Channel) {
    const event = channel.isDirect()
      ? DirectMessageEvent.ADD
      : ChannelEvent.ADD;

    this.broadcastToUser(user, event, channel);
  }

  public notifyAchievementUnlock(
    user: User,
    achievementProgress: AchievementProgress
  ) {
    this.broadcastToUser(user, AchievementEvent.UNLOCK, achievementProgress);
  }

  async askMatchMakingJoin(
    socket: Socket,
    body: { id: number },
    callback: Callback
  ) {
    const gameService = Container.get(GameService);
    const pendingGameService = Container.get(
      require("./PendingGameService").default
    ) as any;

    try {
      this.ensureBody(body);
      const { id } = body;

      let pendingGame = undefined;
      if (id) {
        pendingGame = await pendingGameService.findById(id);

        if (!pendingGame) {
          throw new Error(`no pending game found for id = '${id}'`);
        }
      }
      // if (gameService.findByUser(socket.data.user) || this.matchMakingService.contains(socket))
      //    callback(error, null)
      const game: Game | null = this.matchMakingService.add(
        socket,
        pendingGame
      );

      callback(null, 1);
    } catch (error) {
      console.log(error);
      callback(error, null);
    }
  }

  async askMatchMakingLeave(socket: Socket, body: { id: number }) {
    try {
      this.ensureBody(body);
      const { id } = body;

      this.matchMakingService.remove(socket, id);
    } catch (error) {
      console.log(error);
    }
  }

  async askGameConnect(socket: Socket, body: any, callback: Callback) {
    try {
      this.ensureBody(body);

      const { gameId } = body;

      const game = this.gameService.findById(gameId);

      if (!game) {
        throw new Error("game not found");
      }

      callback(null, {
        player1: game.player1,
        player2: game.player2,
      });
    } catch (error) {
      callback(error, null);
    }
  }

  async askGameMove(socket: Socket, body: any, callback: Callback) {
    try {
      this.ensureBody(body);

      const { gameId, y } = body;

      if ([gameId, y].includes(undefined)) {
        return callback(new Error("invalid value"), null);
      }

      const success = this.gameService.gameMove(gameId, socket.data.user, y);

      if (!success) {
        throw new Error("invalid position");
      }

      callback(null, y);
    } catch (error) {
      callback(error, null);
    }
  }

  async gameRestart(socket, body) {
    console.log("game restrt back");
    const io = Container.get(socketio.Server);
    const { gameId, option } = body;
    console.log("option first : " + option);
    const game: Game | false = this.gameService.gameRestartWaitingRoom(
      gameId,
      socket.data.user,
      option
    );
    console.log("game restart : " + game);
    if (game !== false) {
      io.to(game.toRoom()).emit("game_restart", { gameId: game.id });
      game.restart();
      console.log("starting....");
    }
  }

  gameDisconnect(socket){
    console.log('DISCONNECT')
    const io = Container.get(socketio.Server);
    const { game, ret } = this.gameService.gameDisconnect(
      socket.data.user
    )
    // console.log('game restart : ' + game)
    // if (game !== false)
    // {
    //   io.to(game.toRoom()).emit('game_disconnect', { gameId: game.id })
    //   game.restart()
    //   console.log('starting....')
    // }
    console.log('game exit')
    console.log('RET: ' + ret)
    if (game && !ret)
    {
      console.log('game exit')
      io.to(game.toRoom()).emit('game_exit', { gameId: game.id })
    }
    // if (game && ret)
    // {
    //   console.log('game exit BOTH')
    //   io.emit("client_playing_quit", game.player1.id);
    //   io.emit("client_playing_quit", game.player2.id);
    // }
  }

  async matchMaking(socket: Socket) {
    const io = Container.get(socketio.Server);
    console.log("matchMaking");
    const game: Game = this.matchMakingService.addSocket(socket);
    console.log("game : " + game);
    if (game != undefined) {
      io.to(game.toRoom()).emit("game_starting", {
        player1: game.player1.id,
        player2: game.player2.id,
        gameId: game.id,
      });
      game.start();
      console.log("starting....");
    }
  }

  public broadcastGameStarting(game: Game) {
    this.broadcastToGame(game, GameEvent.STARTING, {
      id: game.id,
      player1: game.player1,
      player2: game.player2,
    });


    const io = Container.get(socketio.Server);
    io.emit("client_playing_join", game.player1.id);
    io.emit("client_playing_join", game.player2.id);
  }

  private broadcastToChannel(
    channel: Channel,
    event: ChannelEvent,
    message?: any
  ) {
    this.broadcastToRoom(channel.toRoom(), event, message);
  }

  private broadcastToGame(game: Game, event: GameEvent, message?: any) {
    this.broadcastToRoom(game.toRoom(), event, message);
  }

  private broadcastToUser(user: User, event: UserEvent | Event, message?: any) {
    this.broadcastToRoom(user.toRoom(), event, message);
  }

  private broadcastToUsers(
    users: Array<User>,
    event: UserEvent | Event,
    message?: any
  ) {
    this.broadcastToRoom(
      users.map((x) => x.toRoom()),
      event,
      message
    );
  }

  private broadcastToRoom(
    room: string | Array<string>,
    event: Event,
    message?: any
  ) {
    this.io.to(room).emit(event, message?.toJSON?.() || message);

    console.log(`[io]: {${room}} -> ${event}: ${JSON.stringify(message)}`);
  }

  private ensureBody(body: any) {
    if (!body || !isObject(body)) {
      throw new Error("bad body");
    }
  }
}
