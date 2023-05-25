import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class Item {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("text")
  name: string;

  @Column("text")
  description: string;

  @Column("integer")
  price: number;
}
