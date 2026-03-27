<?php
$requestUri = $_SERVER['REQUEST_URI'];
$method = $_SERVER['REQUEST_METHOD'];
$targetUrl = 'http://127.0.0.1:__PORT__' . $requestUri;
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_TIMEOUT, 120);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'])) {
    $body = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}
$forwardHeaders = [];
$skipHeaders = ['host', 'connection', 'accept-encoding'];
foreach (getallheaders() as $name => $value) {
    if (!in_array(strtolower($name), $skipHeaders)) {
        $forwardHeaders[] = "$name: $value";
    }
}
$forwardHeaders[] = 'X-Forwarded-For: ' . $_SERVER['REMOTE_ADDR'];
$forwardHeaders[] = 'X-Forwarded-Proto: ' . (isset($_SERVER['HTTPS']) ? 'https' : 'http');
$forwardHeaders[] = 'X-Forwarded-Host: ' . $_SERVER['HTTP_HOST'];
$forwardHeaders[] = 'Host: ' . $_SERVER['HTTP_HOST'];
$hasOrigin = false;
foreach ($forwardHeaders as $h) {
    if (stripos($h, 'Origin:') === 0) $hasOrigin = true;
}
if (!$hasOrigin) {
    $forwardHeaders[] = 'Origin: https://' . $_SERVER['HTTP_HOST'];
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);
$response = curl_exec($ch);
if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Backend unavailable', 'detail' => curl_error($ch)]);
    curl_close($ch);
    exit;
}
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);
$responseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);
http_response_code($httpCode);
$skipResponseHeaders = ['transfer-encoding', 'connection', 'keep-alive'];
foreach (explode("\r\n", $responseHeaders) as $line) {
    if (empty($line) || strpos($line, 'HTTP/') === 0) continue;
    $colonPos = strpos($line, ':');
    if ($colonPos === false) continue;
    $headerName = strtolower(trim(substr($line, 0, $colonPos)));
    if (in_array($headerName, $skipResponseHeaders)) continue;
    header($line, false);
}
echo $responseBody;
