import { QRCodeSVG } from 'qrcode.react';

/** Broadcast only the server-issued rotating token, with a four-module quiet
 * zone. Student apps already accept raw ATT- tokens as well as older JSON QRs. */
export function AttendanceQRCode({token,courseCode,size}:{token:string;courseCode:string;size:number}) {
  return <QRCodeSVG role="img" aria-label={`Attendance QR code for ${courseCode}`} value={token} size={size} level="M" marginSize={4}/>;
}
