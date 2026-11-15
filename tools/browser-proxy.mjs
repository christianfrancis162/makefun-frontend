import http from 'node:http';
const upstream = new URL(process.env.HTTPS_PROXY);
const server = http.createServer((request,response) => response.writeHead(405).end());
server.on('connect',(request,client,head) => {
 const connection=http.request({hostname:upstream.hostname,port:upstream.port,method:'CONNECT',path:request.url,headers:{Host:request.url,'User-Agent':'curl/8.5.0'}});
 connection.on('connect',(response,socket,buffer) => {
  console.log('Tunnel',request.url,response.statusCode);
  if(response.statusCode!==200){client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');socket.destroy();return;}
  client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
  if(head.length)socket.write(head);if(buffer.length)client.write(buffer);
  client.pipe(socket);socket.pipe(client);
  socket.on('error',()=>client.destroy());client.on('error',()=>socket.destroy());
 });
 connection.on('error',()=>client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'));
 connection.end();
});
server.listen(8899,'127.0.0.1',()=>console.log('Browser proxy listening on 8899'));
