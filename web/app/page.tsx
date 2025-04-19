import { DOC_ID } from "@monorepo/common/constants";
import { ExternalContext } from "@reboot-dev/reboot";
import TestReactively from "./TestReactively";

export default async function Home() {
  const url = "http://localhost:9991";
  const context = new ExternalContext({
    name: "Next.js server context",
    url
  });

  return (
    <>
      <TestReactively url={url} id={DOC_ID}/>
    </>
  );
}
