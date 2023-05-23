import { DataSource, Repository } from "typeorm";
import { ENVS } from "../config/env";
import defaultItems from "../config/items";
import { Payment } from "./payment.entity";
import { Item } from "./item.entity";

export class DB {
  private constructor(private readonly dataSource: DataSource) {
    this.item = this.dataSource.getRepository(Item);
    this.payment = this.dataSource.getRepository(Payment);
  }

  public item: Repository<Item>;
  public payment: Repository<Payment>;

  static connect(): DB {
    const dataSource = new DataSource({
      type: "sqlite",
      database: ENVS.server.dbPath,
      entities: [Item, Payment],
      synchronize: ENVS.debug,
      logging: ENVS.debug,
    });

    return new DB(dataSource);
  }

  async init() {
    await this.dataSource.initialize();
    this.item = this.dataSource.getRepository(Item);
    this.payment = this.dataSource.getRepository(Payment);
    await this.syncItemsFromConfig();
  }

  private async syncItemsFromConfig() {
    // set all items to deleted
    await this.item.delete({});
    for (const item of defaultItems) {
      // create item
      await this.item.save(item);
    }
  }
}
