import { Inject, Service } from "typedi";
import * as otplib from "@otplib/preset-default";
import User from "../entities/User";
import UserService from "./UserService";
import { isError } from "@hapi/joi";

@Service()
export default class OTPService {
  constructor(
    @Inject()
    private readonly userService: UserService
  ) {}

  async enable(user: User) {
    if (!user.otpSecret) {
      user.otpSecret = this.generateSecrets();
    }

    user.otp = true;

    return await this.userService.save(user);
  }

  async disable(user: User) {
    user.otp = false;

    return await this.userService.save(user);
  }

  generateURI(user: User) {
    if (!user.otp) {
      return null;
    }

    return otplib.authenticator.keyuri(
      user.email,
      "ft-transcendence",
      user.otpSecret
    );
  }

  generateSecrets() {
    return otplib.authenticator.generateSecret();
  }
}