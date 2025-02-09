/* eslint-disable prefer-const */
/* eslint-disable jsdoc/require-jsdoc */
import { NextResponse } from "next/server";

let messages: Array<{ message: string; timestamp: number }> = [];
let clients = new Set<WritableStreamDefaultWriter>();

export async function POST(request: Request) {
  const data = await request.json();
  messages.push(data);

  // Notify all connected clients about the new message
  clients.forEach(client => {
    client.write(new TextEncoder().encode(`data: ${JSON.stringify(messages)}\n\n`));
  });

  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  // Added request parameter here
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  clients.add(writer);

  // Send initial messages
  writer.write(new TextEncoder().encode(`data: ${JSON.stringify(messages)}\n\n`));

  // Remove client when connection closes
  request.signal.addEventListener("abort", () => {
    clients.delete(writer);
  });

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
