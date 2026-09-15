import { privateClient } from "@/lib/api/privateClient";

export async function getMyLearning() {
  const { data } = await privateClient.get("/users/me/learning");
  return data.data.items;
}
