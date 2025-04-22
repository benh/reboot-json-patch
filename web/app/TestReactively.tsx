"use client";

import { ChangesRequest, ChangesResponse } from "@monorepo/api/dev/moment/differential/v1/document_rbt_react";
import { useEffect, useState } from "react";
import { reactively } from "./reactively";

export default function TestReactively({ url, id }) {
  const [operations, setOperations] = useState([]);

  useEffect(() => {
    (async () => {
      const [responses, setRequest] = reactively({
        url,
        state: "dev.moment.differential.v1.Document",
        method: "Changes",
        id,
        requestType: ChangesRequest,
        responseType: ChangesResponse,
      });

      // NOTE: can also pass first request as `request` to `reactively`.
      let sinceVersion = 0;
      setRequest({ sinceVersion });

      for await (const { version, patches } of responses) {
        for (const patch of patches) {
          setOperations((operations) => [...operations, patch.operations]);
        }

        // Update the request if we got a new version.
        if (version + patches.length > sinceVersion) {
          sinceVersion = version + patches.length;
          setRequest({ sinceVersion });
        }
      }
    })();
  }, []);

  return (
    <div>
      Patches:
      {operations.map((operation, index) => (
        <div key={index}>
          @version {index}: {JSON.stringify(operation)}
        </div>
      ))}
    </div>
  );
}
