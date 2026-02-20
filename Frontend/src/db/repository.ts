import { db } from './client';
import { Configuration, Webpage, ConfigMode } from './schema';
import Dexie from 'dexie';

/*
you should use await when you call the function if you want the output,
since it will return a promise first then it'll return the desired output

e.g let x = await dbManeger.createConfig(); -> will return the id
    let x = dbManeger.createConfig(); -> will return the a Promise object
*/

export const dbManeger = {
    async createConfig(System_status: boolean = true, mode : ConfigMode = "Both", AskForFeedback:boolean = true) : Promise<number | undefined>{
        try{
            return await db.configuration.add({// it will return the id
                System_status: System_status,
                mode : mode,
                AskForFeedback: AskForFeedback,
            }) as number;
        }catch(error){
            console.error(error);  
        }
    }, 
    async deleteConfig(config_id: number){
        return await db.transaction('rw', [db.configuration, db.webpage], async () => {
            // Everything in here happens as one single "unit" (both happen or neither happen)
            await db.webpage.where("config_id").equals(config_id).delete();
            await db.configuration.delete(config_id);
        });
    },
    async toggleSysStatus(config_id: number, currStatus: boolean){
        const updatedRows = await db.configuration.update(config_id, {System_status : !currStatus});
  
        if (updatedRows) {
            console.log("Update successful!");
        } else {
            console.log("No task found with that ID.");
        }
    },
    async toggleFeedbackRequest(config_id: number, ask: boolean){
        const updatedRows = await db.configuration.update(config_id, {AskForFeedback : !ask});
  
        if (updatedRows) {
            console.log("Update successful!");
        } else {
            console.log("No task found with that ID.");
        }
    },
    async updateMode(config_id : number, newMode : ConfigMode){
        const updatedRows = await db.configuration.update(config_id, {mode : newMode});
  
        if (updatedRows) {
            console.log("Update successful!");
        } else {
            console.log("No task found with that ID.");
        }
    },
    async getConfiguration(config_id: number): Promise<Configuration>{
        const config = await db.configuration.get(config_id);
        if (!config) {
            return { System_status: true, mode : "Both", AskForFeedback: true }; //defalut configuration
            //should i return a new configuration (createConfig())
        }
        return config;
    },

    async addWebpageToWhitelist(config_id:number, BaseURL: string ){//need to check if its there under config_id
        try{
            const normalizedUrl = BaseURL.toLowerCase().trim();
            return await db.webpage.add({
                BaseURL : normalizedUrl,
                config_id : config_id});

        }catch (error) {
            if (error instanceof Dexie.ConstraintError) {
                console.warn(`URL ${BaseURL} is already whitelisted.`);
            } else {
                console.error("Database error:", error);
            }
            return undefined;
    }
    },

    async removeWebpageFromWhitelist(config_id:number, id:number | string){// id could be id or BaseURL (unique)
        try{
            let key :string;
            let val :number | string;
            if(typeof(id) == "string"){
                val= id.toLowerCase().trim(); //url
                key = "BaseURL";
            }else{
                val= id; // id
                key = "webpage_id";
            }
            await db.webpage.where("config_id")
                            .equals(config_id)
                            .and(webpage => (webpage.BaseURL === val || webpage.webpage_id === val))
                            .delete();
            console.log("Webpage ",id, " has been deleted");
        }catch (error){
            console.error(error);
        }
    },

    async resetWhitelist(config_id:number){
        try{
            await db.webpage
                .where("config_id")
                .equals(config_id)
                .delete();

            console.log("whitelist is reseted");
        }catch(error){
            console.error(error);
        }
    },

    async getWhitelist(config_id: number) : Promise<Webpage[]>{ // get all the webpages under configuration 
        return await db.webpage
                    .where("config_id")
                    .equals(config_id)
                    .toArray();
    },
    async isWebpageInWhitelist(config_id:number, BaseURL: string){
        const normalizedUrl = BaseURL.toLowerCase().trim();
        return await db.webpage.where("config_id")
                        .equals(config_id)
                        .and(webpage => webpage.BaseURL === normalizedUrl)
                        .first() !== undefined;
    }

}

