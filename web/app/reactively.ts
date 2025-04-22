import { Message, MessageType, PartialMessage } from "@bufbuild/protobuf";
import * as reboot_react from "@reboot-dev/reboot-react";
import * as reboot_api from "@reboot-dev/reboot-api";

export function reactively<
  RequestType extends Message<RequestType>,
  ResponseType extends Message<ResponseType>
>({
  url,
  state,
  method,
  id,
  requestType,
  responseType,
  request,
  signal,
  bearerToken,
}: {
  url: string,
  state: string;
  method: string;
  id: string;
  requestType: MessageType<RequestType>;
  responseType: MessageType<ResponseType>;
  request?: RequestType;
  signal?: AbortSignal;
  bearerToken?: string;
}): [
  AsyncGenerator<ResponseType, void, unknown>,
  (newRequest: RequestType) => void
] {
  if (request !== undefined) {
    if (!(request instanceof requestType)) {
      throw new TypeError("'request' is not of type 'requestType'");
    }
  }

  // Track whether or not we've got the first request or are still
  // waiting for it.
  const firstRequest = new reboot_react.Event();

  if (request !== undefined) {
    firstRequest.set();
  }

  // We need a separate `AbortController` so we can abort `responses`
  // if/when we get a new request via `setRequest`.
  let responsesAbortController = new AbortController();

  if (signal !== undefined) {
    signal.addEventListener("abort", () => {
      responsesAbortController.abort();
    });
  }

  const setRequest = (partialRequest: PartialMessage<RequestType>) => {
    const isFirstRequest = request === undefined;

    request = partialRequest instanceof requestType
      ? partialRequest
      : new requestType(partialRequest);

    if (isFirstRequest) {
      firstRequest.set();
    } else {
      // Otherwise abort current `responses` so that we'll restart
      // with the new request.
      responsesAbortController.abort();

      responsesAbortController = new AbortController();
    }
  };

  const responses = {
    [Symbol.asyncIterator]: async function* () {
      // Wait for either the first request or an abort.
      await Promise.race([
        firstRequest.wait(),
        new Promise((resolve) => {
          if (signal !== undefined) {
            signal.addEventListener("abort", () => {
              resolve();
            });
          }
        })
      ]);

      while (signal === undefined || !signal.aborted) {
        try {
          const queryRequest = new reboot_api.react_pb.QueryRequest({
            method,
            request: request.toBinary(),
            ...(bearerToken !== undefined && { bearerToken } || {}),
          });

          const stateRef = reboot_react.stateIdToRef(state, id);

          const queryResponses = reboot_react.reactiveReader({
            endpoint: `${url}/__/reboot/rpc/${stateRef}`,
            request: queryRequest,
            signal: responsesAbortController.signal,
          });

          for await (const queryResponse of queryResponses) {
            if (queryResponse.responseOrStatus.case === "response") {
              const response = responseType.fromBinary(
                queryResponse.responseOrStatus.value
              );
              yield response;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
  };

  return [responses, setRequest];
}
