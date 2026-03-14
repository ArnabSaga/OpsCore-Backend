import app from "./app";
import { envVars } from "./app/config/env";

async function main() {
  try {
    app.listen(envVars.PORT, () => {
      console.log(`Example app listening on port ${envVars.PORT}`);
    });
  } catch (err) {
    console.log(err);
  }
}

main();
