export type SendEmailResult =
  | { status: true; message: "email sent"; messageId: string }
  | { status: false; message: string };