<?php
/**
 * Please don't look at this ugly code, I'm only here to help Hayo.
 *
 * @author Frank Houweling <houweling.frank@gmail.com>
 * @date 28/07/2015
 * @copyright Fruitbomen.net 2014
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

$get = $_GET;

$options = ["local" => "http://virtuosop.ddmgraph-uva.vm.surfsara.nl/sparql", "remote" => "http://linkeddata.uriburner.com/sparql"];

$server = $options[$get['server']];

unset($get['server']);

$finalUri = $server . "?" . http_build_query($get);

// Look if it already exists in cache
if( apc_exists($finalUri) ){
    $content = apc_fetch($finalUri);
} else{
    $content = file_get_contents($finalUri);

    if( !empty($content) && count( json_decode($content) ) > 0 ){
        apc_store($finalUri, $content, 43200);
    }

}

header( "access-control-allow-origin:*" );
header( "Content-Type:application/sparql-results+json" );

echo $content;