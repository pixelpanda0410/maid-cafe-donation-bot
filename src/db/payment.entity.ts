import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  status: string;

  @Column()
  payID: string;

  @Column()
  orderID: string;

  @Column()
  receiver: string;

  @Column()
  amount: string;

  @Column()
  originalAmount: string;

  @Column()
  maxFeeAmount: string;

  @Column()
  chatID: number;

  @Column("datetime")
  deadline: Date;

  @Column({ nullable: true })
  owner?: string;

  @Column({ nullable: true })
  depositAddress?: string;

  @Column({ nullable: true })
  callID?: number;

  @Column({ nullable: true })
  receiveTxID?: string;

  @Column({ nullable: true })
  receiveChainID?: number;

  @Column({ nullable: true })
  receiveChainName?: string;

  @Column({ nullable: true })
  receiveTokenSymbol?: string;

  @Column({ nullable: true })
  receiveTokenAddress?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
