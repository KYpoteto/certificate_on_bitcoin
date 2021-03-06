const http = require('http');
const fs = require('fs');
const ejs = require('ejs');
const qs = require('querystring');
const bitcoin = require('bitcoinjs-lib');
const settings = require('./settings');
const verification = require('./verification-server');
const issue = require('./issue-server');

const issue_template = fs.readFileSync(__dirname + '/issue.ejs', 'utf-8');
const verify_tmplate = fs.readFileSync(__dirname + '/verify.ejs', 'utf-8');

const server = http.createServer(
    function (req, res){
        let url = req.url;
        let url_array = url.split('.');
        let ext = url_array[url_array.length - 1];
        let path = '.' + url;
        if(ext == 'js'){
            fs.readFile(path, function(err, data){
                res.writeHead(200, {"Content-Type": "text/javascript"});
                res.end(data, 'utf-8');
            })
        }
         else{
            switch(req.url){
                case '/issue':
                    if(req.method === 'POST'){
                        req.on("readable", function(){
                            req.data += req.read() || '';
                        })
                        req.on("end", async function(){
                            let input_data = qs.parse(req.data);
                            console.log(input_data);
                            if(input_data.phase == '1'){
                                let utxos = await issue.get_utxo(input_data.address);
                                res.write('{"result": ' + (utxos != null? '"OK"': '"NG"') + ', "utxos": ' + JSON.stringify(utxos) + '}');
                                res.end();
                            }
                            else if(input_data.phase == '2'){
                                let result = await issue.broadcast(input_data.rawtx);
                                res.write('{"result": ' + (result == true? '"OK"': '"NG"') + '}');
                                res.end();
                            }
                            else{
                                res.write('{result: "NG"}');
                                res.end();
                            }
                        })
                    }
                    else{
                        var data = ejs.render(issue_template,{
                            prvkey_type: (settings.network == bitcoin.networks.bitcoin? 'xprv...': 'tprv...')
                        });
                        res.writeHead(200, {'Content-Type': 'text/html'});
                        res.write(data);
                        res.end();
                    }
                    break;
                case '/verify':
                    if(req.method === 'POST'){
                        req.on("readable", function(){
                            req.data += req.read() || '';
                        })
                        req.on("end", async function(){
                            let input_data = qs.parse(req.data);
                            console.log(input_data);
                            let result = await verification.verify(input_data.txid, input_data.digest, input_data.address);

                            var data = ejs.render(verify_tmplate, {
                                txid: input_data.txid,
                                address: input_data.address,
                                certificate: input_data.certificate,
                                result: (result.result == true? "OK": "NG") + "（" + result.message + "）"});
                            res.writeHead(200, {'Content-Type': 'text/html'});
                            res.write(data);
                            res.end();
                        })
                    }
                    else{
                        var data = ejs.render(verify_tmplate, {
                            txid: "",
                            address: "",
                            certificate: "",
                            result: ""});
                        res.writeHead(200, {'Content-Type': 'text/html'});
                        res.write(data);
                        res.end();
                    }
                    break;
                default:
                    res.writeHead(404, {'Content-Type': 'text/plain'});
                    res.write('not found');
                    res.end();
                    break;
            }
        }
    }
).listen(3000);
console.log('Server running at http://localhost:3000/');