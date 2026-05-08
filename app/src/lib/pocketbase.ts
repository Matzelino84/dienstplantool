import PocketBase from "pocketbase";

const url =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/dienstplan-pb`
    : "http://127.0.0.1:8090");

const pb = new PocketBase(url);

pb.autoCancellation(false);

export default pb;
