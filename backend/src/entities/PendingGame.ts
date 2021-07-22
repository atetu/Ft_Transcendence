import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { GameSettings } from "../game/Game";
import ChannelMessage from "./ChannelMessage";
import User from "./User";

@Entity({
  name: "pending_games",
})
export default class PendingGame implements GameSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, {
    eager: true,
    onDelete: "CASCADE",
    nullable: false,
  })
  user: User;

  @ManyToOne(() => User, {
    eager: true,
    onDelete: "CASCADE",
    nullable: false,
  })
  peer: User;

  @ManyToOne(() => ChannelMessage, {
    eager: false,
    onDelete: "CASCADE",
  })
  message: Promise<ChannelMessage>;

  @Column()
  map: number

  @Column()
  ballVelocity: number

  @Column()
  paddleVelocity: number

  @Column()
  nbGames: number

  public toJSON() {
    return {
      id: this.id,
      user: this.user,
      peer: this.peer,
    };
  }

  public toRoom(): string {
    return `pending_games${this.id}`;
  }
}
