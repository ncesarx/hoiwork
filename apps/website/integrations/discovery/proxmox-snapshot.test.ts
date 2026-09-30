import assert from "node:assert/strict";
import { test } from "node:test";
import { collectProxmoxSnapshot } from "./proxmox-snapshot";

type Client = Parameters<typeof collectProxmoxSnapshot>[0];

function client(): Client {
  return {
    version: async () => ({ version: "9.2" }),
    nodes: async () => [{ node: "hoi" }, { node: "homeoffice" }],
    guests: async () => [{ id: "qemu/105", type: "qemu", vmid: 105, node: "hoi" }],
    storages: async () => [],
    clusterStatus: async () => [{ type: "cluster", name: "hoi-cloud" }],
    network: async (node) => [{ iface: `vmbr-${node}`, type: "bridge" }],
  };
}

test("complete discovery snapshot includes each node network before it can be saved", async () => {
  const snapshot = await collectProxmoxSnapshot(client());
  assert.deepEqual(snapshot.networksByNode.map(({ nodeName }) => nodeName), ["hoi", "homeoffice"]);
  assert.deepEqual(snapshot.networksByNode.map(({ interfaces }) => interfaces[0].iface), ["vmbr-hoi", "vmbr-homeoffice"]);
  assert.equal(snapshot.guests.length, 1);
});

test("failed network collection rejects the snapshot", async () => {
  const source = client();
  await assert.rejects(
    collectProxmoxSnapshot({
      ...source,
      network: async (node) => {
        if (node === "homeoffice") throw new Error("Proxmox API HTTP 403");
        return [{ iface: "vmbr0", type: "bridge" }];
      },
    }),
    /HTTP 403/,
  );
});

test("empty node response rejects the snapshot before removing old resources", async () => {
  await assert.rejects(
    collectProxmoxSnapshot({ ...client(), nodes: async () => [] }),
    /inventário anterior preservado/,
  );
});
