import * as dotenv from "dotenv";
 
export class BuildConfig{
    private readonly nameStackApplication:string
    private readonly stage:string = "dev"
 
    constructor(nameStackApplication:string,stage:string){
        this.nameStackApplication = nameStackApplication
        this.stage = stage
    }
 
 
    async getConfig(): Promise<any> {
        try {
          dotenv.config();
          let buildConfigResponse: any
                const nameEnvironmentSsm = `/${this.nameStackApplication}/${this.stage}`
                console.log(`### STARTING GITHUB ACTIONS"`);
                console.log(`### Getting config from .env`);
                buildConfigResponse = {
                STAGE: this.stage, // variable by defual, not remove it
                ENDPOINT_RECEIVE_STATUS_LATINIA: process.env.ENDPOINT_RECEIVE_STATUS_LATINIA,
                SN_LATINIA_DEV_MID_1A: process.env.SN_LATINIA_DEV_MID_1A,
                SN_LATINIA_LIMSPCC_DEV_MID_1A: process.env.SN_LATINIA_LIMSPCC_DEV_MID_1A,
                SN_LATINIA_DEV_MID_1b: process.env.SN_LATINIA_DEV_MID_1b,
                SN_LATINIA_LIMSPCC_DEV_MID_1B: process.env.SN_LATINIA_LIMSPCC_DEV_MID_1B,
                SN_LATINIA_DEV_MID_1C: process.env.SN_LATINIA_DEV_MID_1C,
                SN_LATINIA_LIMSPCC_DEV_MID_1C: process.env.SN_LATINIA_LIMSPCC_DEV_MID_1C,
                SUBNET_IDS: process.env.SUBNET_IDS,
                AWS_ACCOUNT_USER: process.env.AWS_ACCOUNT_USER,
                AWS_CDK_REGION: process.env.AWS_CDK_REGION
               
            }
            console.log(`### buildConfig OK ${JSON.stringify(buildConfigResponse)}`)
            return buildConfigResponse
        } catch (error) {
            console.log("error getConfig", error)
            console.log(`### I can't retrive the ENV Parameter from Infra Repository`)
            return{
                STAGE: this.stage
            }
        }
    }
 
 
    ensureString(object: { [name: string]: any }, propName: string): string {
        if (!object[propName] || object[propName].trim().length === 0)
            throw new Error(propName + " does not exist or is empty");
 
        return object[propName];
    }
 
}