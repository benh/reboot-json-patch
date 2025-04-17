import { PartialMessage, Value, JsonValue } from "@bufbuild/protobuf";
import {
  ApplyRequest,
  ApplyResponse,
  CreateRequest,
  CreateResponse,
  Document,
  InvalidOperation,
  Patch,
  PatchesRequest,
  PatchesResponse,
} from "@monorepo/api/dev/moment/differential/v1/document_rbt";
import { DOC_ID } from "@monorepo/common/constants";
import { Application, ReaderContext, WriterContext } from "@reboot-dev/reboot";
import { errors_pb } from "@reboot-dev/reboot-api";
import { applyPatch } from "fast-json-patch/index.mjs";

type Version = number;

export class DocumentServicer extends Document.Servicer {
  #values: { [key: string]: [Version, JsonValue] };

  constructor() {
    super();
    this.#values = {};
  }

  private value(stateId: string, state: Document.State) {
    let [version, value]: [number, JsonValue] =
      stateId in this.#values ? this.#values[stateId] : [0, {}];

    if (version < state.patches.length) {
      const patches = state.patches.slice(version);

      for (const patch of patches) {
        value = applyPatch(
          value,
          [...patch.operations.map((operation) => operation.toJson())],
        ).newDocument;

        version++;
      }

      this.#values[stateId] = [version, value];
    }

    return value;
  }

  async create(
    context: WriterContext,
    state: Document.State,
    request: CreateRequest
  ): Promise<PartialMessage<CreateResponse>> {
    return {
      value: Value.fromJson(this.value(context.stateId, state)),
      version: state.patches.length,
    };
  }

  async apply(
    context: WriterContext,
    state: Document.State,
    request: ApplyRequest
  ): Promise<PartialMessage<ApplyResponse>> {
    if (request.version != state.patches.length) {
      throw new Document.ApplyAborted(new errors_pb.FailedPrecondition());
    }

    // Validate that we can apply these changes!
    let value = this.value(context.stateId, state);

    try {
      value = applyPatch(
        value,
        [...request.operations.map((operation) => operation.toJson())],
        /* validateOperation = */ true,
        /* mutateDocument = */ false
      ).newDocument;
    } catch (error) {
      throw new Document.ApplyAborted(new InvalidOperation({
        message: error.message,
        index: error.index,
      }));
    }

    // NOTE: we don't save `value` in `this.#values` as that is
    // a side-effect; instead `this.value(...)` will correctly
    // return an up-to-date value based on the latest `state` when
    // ever we need it.

    state.patches = [
      ...state.patches,
      new Patch({ operations: request.operations })
    ];

    return {};
  }

  async changes(
    context: ReaderContext,
    state: Document.State,
    { sinceVersion }: ChangesRequest
  ): Promise<PartialMessage<ChangesResponse>> {
    if (sinceVersion > state.patches.length) {
      throw new Document.ChangesAborted(new errors_pb.InvalidArgument());
    }

    return {
      version: sinceVersion,
      patches: state.patches.slice(sinceVersion),
    };
  }
}

const initialize = async (context) => {
  const document = Document.ref(DOC_ID);

  await document.idempotently().create(context);

  await document.idempotently("patch 1").apply(context, {
    version: 0,
    operations: [
      { op: "add", path: "/firstName", value: Value.fromJson("Alex") },
      { op: "add", path: "/lastName", value: Value.fromJson("Clemmer") },
    ],
  });

  await document.idempotently("patch 2").apply(context, {
    version: 1,
    operations: [
      {
        op: "add",
        path: "/contactDetails",
        value: Value.fromJson({ number: "206-123-4567" })
      }
    ],
  });

  const { version, patches } = await document.changes(context);

  console.log(`Patches from version ${version} to ${patches.length}:`);

  for (const patch of patches) {
    const operations = [
      ...patch.operations.map((operation) => operation.toJson())
    ];
    console.log(`${JSON.stringify(operations)}`);
  }
};

new Application({ servicers: [DocumentServicer], initialize }).run();
