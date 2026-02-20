import Dexie, { Table } from 'dexie';

export type ConfigMode = 'AI' | 'Malicious Code' | 'Both';

export interface Configuration {
  config_id?: number; // make it optional parameter with '?' (the databse will initialize it)
  System_status: boolean;
  mode : ConfigMode;
  AskForFeedback: boolean;
}
export interface Webpage {
  webpage_id?: number;
  BaseURL: string;
  config_id : number;
}

export class MyDb extends Dexie{
  configuration!: Table<Configuration>; // '!' tells the compiler it is not null nor undefined
  webpage!: Table<Webpage>;

  constructor(){
    super("GAMBA_db"); //name

    this.version(2).stores({// make the schema Tabel:Values 
      configuration : "++config_id, System_status, mode, AskForFeedback",
      webpage : "++webpage_id, &[config_id+BaseURL], config_id",// '&' mean unique
    })

  }

}

