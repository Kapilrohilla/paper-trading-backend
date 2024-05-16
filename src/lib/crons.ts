import cron from "node-cron";
import instruments from "./instuments.lib";
const cronJobs = () => {
    // cron.schedule('* 23 * * *', instruments.getInstrumentListCSV);
    // cron.schedule('* * * * *', instruments.getInstrumentListCSV);
    // instruments.getInstrumentListCSV();
}
export default cronJobs;