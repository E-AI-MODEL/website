<?php
declare(strict_types=1);
require __DIR__.'/../tools/ict-scan/edit-api.php';
function check($v,string $message): void {if(!$v)throw new RuntimeException($message);}
function denied(callable $f): void {try{$f();}catch(RuntimeException $e){check(in_array($e->getCode(),[400,403,409],true),'Wrong failure status');return;}throw new RuntimeException('Forbidden request accepted');}
$profile=json_decode(file_get_contents(__DIR__.'/../tools/ict-scan/assurance/profiles/emmauscollege.json'),true);
$files=ict_policy_files($profile);check(count($files['data'])===4,'Source file scope');
$cfg=['token'=>'synthetic-server-credential-123456','hash'=>password_hash('fixture',PASSWORD_DEFAULT),'actor'=>'ICT-scan-editor'];
$root='https://api.github.com'.ICT_REPO;$base=str_repeat('a',40);$old=str_repeat('b',40);$new=str_repeat('c',40);
$state=['base'=>$base,'seen'=>array_fill_keys(array_merge($files['data'],[ICT_MANIFEST,ICT_LAYOUT]),$old),'branches'=>[]];
$run=function($method,$url,$body=[])use(&$state,$files,$cfg){return ict_route($method,$url,$body,$state,$files,$cfg);};
$branch='applicatielandschap/kaart-2026-11-24-12345678';
$ref=['ref'=>'refs/heads/'.$branch,'sha'=>$base];
check($run('GET',$root.'/git/ref/heads/main')['kind']==='head','Head');
check($run('GET',$root.'/contents/'.$files['data'][0].'?ref='.$base)['kind']==='read','Allowed source');
foreach(['https://evil.example'.ICT_REPO.'/git/refs','https://api.github.com/repos/another/repo/git/refs','https://api.github.com:8443'.ICT_REPO.'/git/refs',$root.'/git/refs?extra=1'] as $url)denied(fn()=>$run('POST',$url,$ref));
denied(fn()=>$run('GET',$root.'/contents/.github/workflows/deploy-theory7.yml?ref='.$base));
denied(fn()=>$run('GET',$root.'/git/blobs/'.str_repeat('f',40)));
denied(fn()=>$run('POST',$root.'/git/refs',['ref'=>'refs/heads/main','sha'=>$base]));
denied(fn()=>$run('POST',$root.'/git/refs',['ref'=>$ref['ref'],'sha'=>$new]));
ict_record_result($run('POST',$root.'/git/refs',$ref),[],$state);
$write=['message'=>'Voorbeeld','content'=>base64_encode(json_encode(['schema'=>'eai-school-ict-v1','apps'=>[]])),'sha'=>$old,'branch'=>$branch];
denied(fn()=>$run('PUT',$root.'/contents/'.$files['data'][0],array_replace($write,['branch'=>'main'])));
denied(fn()=>$run('PUT',$root.'/contents/'.ICT_LAYOUT,$write));
denied(fn()=>$run('PUT',$root.'/contents/README.md',$write));
denied(fn()=>$run('PUT',$root.'/contents/'.$files['data'][0],array_replace($write,['sha'=>$new])));
denied(fn()=>$run('PUT',$root.'/contents/'.$files['data'][0],array_replace($write,['content'=>base64_encode(json_encode(['schema'=>'eai-school-ict-v1','secret'=>$cfg['token']]))])));
$pull=['title'=>'Voorbeeld','body'=>'Test','head'=>$branch,'base'=>'main'];
denied(fn()=>$run('POST',$root.'/pulls',$pull));
ict_record_result($run('PUT',$root.'/contents/'.$files['data'][0],$write),['content'=>['sha'=>$new]],$state);
$entries=array_map(fn($p)=>['path'=>basename($p),'sha'=>$p===$files['data'][0]?$new:$old],$files['data']);
$manifest=array_replace($write,['content'=>base64_encode(json_encode(['schema'=>'eai-school-ict-manifest-v1','dataFiles'=>$entries]))]);
ict_record_result($run('PUT',$root.'/contents/'.ICT_MANIFEST,$manifest),['content'=>['sha'=>$new]],$state);
ict_record_result($run('POST',$root.'/pulls',$pull),[],$state);
check(!isset($state['branches'][$branch]),'Closed proposal');
denied(fn()=>$run('PUT',$root.'/contents/'.$files['data'][0],$write));
echo "ICT server route-policy: geslaagd\n";
