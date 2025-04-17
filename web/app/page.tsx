import { DOC_ID } from "@monorepo/common/constants";
import { ExternalContext } from "@reboot-dev/reboot";

export default async function Home() {
  const context = new ExternalContext({
    name: "react server context",
    url: "http://localhost:9991",
  });

  return <div>Coming soon!</div>;
}
