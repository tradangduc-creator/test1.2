const region = "ap-southeast-1";
const iotEndpoint =
  "d09840952yd35x21r22e5-ats.iot.ap-southeast-1.amazonaws.com";
const identityPoolId = "ap-southeast-1:913bd9cf-9470-4c4a-93eb-c1397e05f723";
const TOPIC_CMD = "iot/esp32/cmd";
const TOPIC_STATE = "iot/esp32/state";

import { mqtt5, iot } from "https://cdn.skypack.dev/aws-iot-device-sdk-v2";
import { fromCognitoIdentityPool } from "https://cdn.skypack.dev/@aws-sdk/credential-provider-cognito-identity";

const $ = (s) => document.querySelector(s);
const logEl = $("#log");
const connState = $("#connState");
const log = (t) => {
  logEl.textContent += t + "\n";
  logEl.scrollTop = logEl.scrollHeight;
};

let client = null;

async function connect() {
  try {
    connState.textContent = "Đang kết nối...";
    const creds = fromCognitoIdentityPool({
      identityPoolId,
      clientConfig: { region },
    });

    const cfg =
      iot.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigV4Auth(
        { region, credentialsProvider: { getCredentials: () => creds() } },
        { hostName: iotEndpoint }
      )
        .withClientId("web-" + Math.random().toString(16).slice(2))
        .build();

    client = new mqtt5.Mqtt5Client(cfg);

    client.on("connectionSuccess", () => {
      connState.textContent = "✅ Connected";
      log("Đã kết nối MQTT");
    });
    client.on("error", (e) => log("ERR: " + (e?.message || e)));
    client.on("messageReceived", (e) => {
      const payload = new TextDecoder().decode(e.message.payload);
      log(`← ${e.message.topicName}: ${payload}`);
    });

    await client.start();
    await client.subscribe({
      subscriptions: [{ qos: mqtt5.QoS.AtLeastOnce, topicFilter: TOPIC_STATE }],
    });
    log(`🔔 Subscribed ${TOPIC_STATE}`);
  } catch (e) {
    connState.textContent = "❌ Lỗi";
    log("Connect failed: " + (e?.message || e));
  }
}

async function publishCmd(payload) {
  if (!client) return log("⚠️ Chưa kết nối");
  await client.publish({
    qos: mqtt5.QoS.AtLeastOnce,
    topicName: TOPIC_CMD,
    payload: new TextEncoder().encode(
      JSON.stringify({ ...payload, ts: Date.now() })
    ),
  });
  log(`→ ${TOPIC_CMD}: ${JSON.stringify(payload)}`);
}

$("#btnConnect").onclick = connect;
document.querySelectorAll("[data-cmd]").forEach((btn) => {
  btn.onclick = () => publishCmd({ cmd: btn.dataset.cmd });
});
$("#btnSetFreq").onclick = () => {
  const hz = +$("#freq").value || 0;
  publishCmd({ cmd: "set_freq", hz });
};
