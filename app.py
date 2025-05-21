# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests # Python 的 requests 庫
import json
import re
import traceback # 用於打印詳細錯誤
import logging # 引入 logging 模組
from datetime import datetime, timezone # 引入 timezone

app = Flask(__name__)
CORS(app)

# --- Ollama 配置 ---
OLLAMA_BASE_API_URL = "http://localhost:11434"
# *** 模型名稱現在硬編碼在後端 ***
# *** 確保這個模型名稱是你 Ollama 中實際存在的模型 ***
CHAT_MODEL_NAME = "my-custom-llama3"
FEEDBACK_MODEL_NAME = "my-custom-llama3" # 或者你可以為回饋使用不同的模型

# --- 推理函數 (與之前類似，只是 style_instruction 可能需要確認) ---
def create_inference_prompt(persona, goal, conversation_history, last_message):
    prompt_parts = []
    style_instruction = """### **[絕對規則] 目標輸出風格 (MUST FOLLOW RULES):**
*   **核心要求 (Core Requirement)**: 100% 模仿台灣大學生用 LINE 聊天。輸出**必須極度簡短**！每個概念、**甚至每個短語或語氣詞**都必須拆成獨立的短訊息，並且**只能**使用換行符 `\\n` 來分隔這些短訊息。**單行文字必須非常短！**
*   **絕對禁止 (ABSOLUTELY FORBIDDEN - DO NOT USE):**
    *   **任何 Emoji**。 *   **逗號** `,`。 *   **句號** `.` 或 `。`。 *   **引號** `"` `'` 「」 『』。
    *   **頓號** `、`。 *   **分號** `;` 或 `；`。 *   **冒號** `:` 或 `：`。 *   **括號** `()` `（）` `[]`。
    *   **任何項目符號或列表標記**。 *   **任何 "話翼:" 或類似的角色/機器人名稱前綴**。
    *   **生成過長的單行訊息 (重要！單行盡量簡短，多用 \\n 分隔)**。
*   **唯一允許的標點 (ONLY ALLOWED PUNCTUATION):**
    *   **空格** ` `。 *   **換行符** `\\n`。 *   **問號** `？` (少量)。 *   **驚嘆號** `！` (少量)。
*   **訊息長度 (Message Length)**: 總回覆非常簡短。1 到 4 個 `\\n` (2 到 5 則短訊息)。**每則獨立的短訊息 (換行符之間的部分) 應極其簡短，例如 3 到 15 個字為佳。**
*   **輸出格式範例 (Output Format Examples):**
    *   **好的範例 (正確分行，單行簡短):**
        *   範例 1:\n喔喔\n原來是這樣
        *   範例 2:\n欸\n那你想去哪\n我看看時間
        *   範例 3:\n哈哈\n真的假的\n笑死
        *   範例 4:\n嗯嗯\n好啊\n等等喔
    *   **不好的範例 (單行過長，請避免，務必用 \\n 拆分):**
        *   壞範例 1: 喔喔原來是這樣 (應拆成 "喔喔\\n原來是這樣")
        *   壞範例 2: 欸那你想去哪我看看時間 (應拆成 "欸\\n那你想去哪\\n我看看時間")
        *   壞範例 3: 我也還沒睡醒啦正在滑手機你呢 (應拆成 "我也還沒睡醒啦\\n正在滑手機\\n你呢")
        *   壞範例 4: 抱歉我沒想到你會那麼認真還是太早了點呢 (應拆成 "抱歉\\n我沒想到你會那麼認真\\n還是太早了點呢")"""
    prompt_parts.append(style_instruction)
    if persona: prompt_parts.append(f"### 對方資訊 (Persona):\n{persona}")
    if goal: prompt_parts.append(f"### 你的對話目標 (Your Goal):\n{goal}")
    context_str = ""
    if conversation_history and isinstance(conversation_history, list):
        history_limit = 6
        limited_history = conversation_history[-history_limit:]
        context_str += "\n".join(limited_history)
    if last_message:
        last_msg_clean = str(last_message).replace('\n', ' ')
        if context_str:
            context_str += f"\n對方剛說：{last_msg_clean}"
        else:
            context_str = f"對方剛說：{last_msg_clean}"
    if context_str:
        prompt_parts.append(f"### 對話紀錄 (Context):\n{context_str}")
    prompt_content = "\n\n".join(prompt_parts)
    final_user_content = (
        f"參考下方所有資訊，並**嚴格遵守**上面列出的**所有絕對規則**，生成一個建議回覆。\n\n"
        f"{prompt_content}\n\n"
        f"**嚴格依照所有規則，直接生成**極度簡短且用 `\\n` 分隔的建議回覆："
    )
    ollama_full_prompt = (
        f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n"
        f"{final_user_content}"
        f"<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
    )
    return ollama_full_prompt

# --- Ollama API 調用函數 ---
# *** model_to_use 參數現在由調用者（如 chat_py_endpoint）從後端配置中傳入 ***
def generate_with_ollama(full_prompt_str, model_name_for_request):
    ollama_generate_url = f"{OLLAMA_BASE_API_URL}/api/generate"
    payload = {
        "model": model_name_for_request, # 使用從後端配置中確定的模型名稱
        "prompt": full_prompt_str,
        "stream": False,
        "raw": True,
        "options": {
            "temperature": 0.2,
            "top_p": 0.7,
            "repeat_penalty": 1.15,
            "num_predict": 60,
            "stop": ["<|eot_id|>", "<|end_of_text|>"]
        }
    }
    try:
        app.logger.info(f"向 Ollama ({ollama_generate_url}) 發送請求，模型: {model_name_for_request}")
        response = requests.post(ollama_generate_url, json=payload, timeout=(10, 120))
        response.raise_for_status()
        response_data = response.json()
        generated_text = response_data.get("response", "").strip()
        app.logger.info(f"Ollama 原始回覆 (模型 {model_name_for_request}): {repr(generated_text)}")
        return generated_text
    except requests.exceptions.Timeout:
        app.logger.error(f"調用 Ollama API ({model_name_for_request}) 時發生超時錯誤！")
        raise Exception(f"Ollama API ({model_name_for_request}) 超時")
    except requests.exceptions.ConnectionError as e:
        app.logger.error(f"調用 Ollama API ({model_name_for_request}) 時發生連接錯誤: {e}")
        raise Exception(f"Ollama API ({model_name_for_request}) 連接錯誤: {OLLAMA_BASE_API_URL}")
    except requests.exceptions.RequestException as e:
        app.logger.error(f"調用 Ollama API ({model_name_for_request}) 時發生錯誤: {e}")
        error_detail = ""
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                app.logger.error(f"Ollama 錯誤詳情 (JSON): {error_detail}")
            except json.JSONDecodeError:
                error_detail = e.response.text
                app.logger.error(f"Ollama 錯誤詳情 (非JSON): {error_detail}")
        if isinstance(error_detail, dict) and "error" in error_detail and "model not found" in error_detail["error"].lower():
            raise Exception(f"Ollama API 錯誤: 模型 '{model_name_for_request}' 未找到。請確認 Ollama 已下載或創建該模型。")
        # 將原始的 HTTPError 訊息傳遞出去，而不是只傳遞 URL
        raise Exception(f"Ollama API ({model_name_for_request}) 請求錯誤: {e}") # 保持原樣以獲得更詳細的 requests 錯誤
    except Exception as e:
        app.logger.error(f"生成回覆過程中 (模型 {model_name_for_request}) 發生未知錯誤: {e}\n{traceback.format_exc()}")
        raise Exception(f"未知內部錯誤 ({model_name_for_request}): {e}")

# --- 後處理函數 (保持不變) ---
prefix_pattern = re.compile(r'^\s*(?:話翼|AI|Assistant|模型|回答|建議)\s*[:：]?\s*', re.IGNORECASE)
punctuation_to_remove = ".。、；：「」『』（）《》\"'();:"
def post_process_reply(raw_ai_reply):
    cleaned_reply_step1 = prefix_pattern.sub('', raw_ai_reply).strip()
    cleaned_reply_step2 = cleaned_reply_step1.replace(',', ' ')
    cleaned_reply_step2 = cleaned_reply_step2.replace('，', ' ')
    cleaned_reply_step3 = cleaned_reply_step2
    for punc in punctuation_to_remove:
        cleaned_reply_step3 = cleaned_reply_step3.replace(punc, '')
    cleaned_reply_step4 = cleaned_reply_step3.replace('\\n', '\n')
    processed_reply = cleaned_reply_step4
    lines = processed_reply.split('\n')
    cleaned_lines = [line.strip() for line in lines if line.strip()]
    final_reply = "\n".join(cleaned_lines)
    return final_reply

# --- API 端點 ---
@app.route('/api/chat_py', methods=['POST'])
def chat_py_endpoint():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "請求主體必須是 JSON"}), 400

        current_persona = data.get('character', {}).get('description', "一個友善的聊天夥伴")
        current_goal = data.get('goal', "輕鬆聊天")
        js_messages = data.get('messages', [])
        
        # *** 模型名稱現在由後端配置決定 ***
        model_to_use_for_this_request = CHAT_MODEL_NAME # 使用後端定義的聊天模型
        app.logger.info(f"API /api/chat_py - 使用後端配置模型: {model_to_use_for_this_request}")

        dialog_messages_for_processing = [m for m in js_messages if m.get('role') != 'system']
        py_style_conversation_history = []
        current_last_user_message = ""

        if dialog_messages_for_processing:
            if dialog_messages_for_processing[-1].get('role') == 'user':
                current_last_user_message = dialog_messages_for_processing[-1].get('content', '').replace(chr(10), ' ')
                for msg in dialog_messages_for_processing[:-1]:
                    role = msg.get('role')
                    content = msg.get('content', '').replace(chr(10), ' ')
                    if role == 'user':
                        py_style_conversation_history.append(f"對方：{content}")
                    elif role == 'assistant':
                        py_style_conversation_history.append(f"你：{content}")
            else:
                current_last_user_message = ""
                for msg in dialog_messages_for_processing:
                    role = msg.get('role')
                    content = msg.get('content', '').replace(chr(10), ' ')
                    if role == 'user':
                        py_style_conversation_history.append(f"對方：{content}")
                    elif role == 'assistant':
                        py_style_conversation_history.append(f"你：{content}")
        
        app.logger.info(f"接收到的 goal: {current_goal}")
        app.logger.info(f"接收到的 persona: {current_persona}")
        app.logger.info(f"用於生成 prompt 的 Python 風格 history: {py_style_conversation_history}")
        app.logger.info(f"用於生成 prompt 的 last_message (用戶剛說): {current_last_user_message}")

        full_prompt = create_inference_prompt(
            persona=current_persona,
            goal=current_goal,
            conversation_history=py_style_conversation_history,
            last_message=current_last_user_message
        )
        # app.logger.debug(f"生成的完整 Prompt: {full_prompt}")

        raw_ollama_reply = generate_with_ollama(full_prompt, model_to_use_for_this_request)
        final_reply = post_process_reply(raw_ollama_reply)
        app.logger.info(f"後處理後的回覆: {repr(final_reply)}")

        response_to_frontend = {
            "model": model_to_use_for_this_request, # 返回後端實際使用的模型
            "created_at": datetime.now(timezone.utc).isoformat(), # 使用 timezone.utc
            "message": {
                "role": "assistant",
                "content": final_reply
            },
            "done": True
        }
        return jsonify(response_to_frontend), 200

    except Exception as e:
        app.logger.error(f"API 端點 /api/chat_py 發生嚴重錯誤: {e}\n{traceback.format_exc()}")
        error_response = {
            "error": str(e), # 包含來自 generate_with_ollama 的詳細錯誤訊息
            "done": True
        }
        # 模型名稱在這種情況下是後端配置的
        error_response["model"] = CHAT_MODEL_NAME # 或者可以是引發錯誤時嘗試使用的模型
        return jsonify(error_response), 500

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    # 讓 Flask 的 logger 也使用 basicConfig 的設定 (如果需要更精細的控制，可以使用 Flask 的 logger 配置)
    # app.logger.handlers = logging.getLogger().handlers # 這樣會共享 root logger 的 handlers
    # app.logger.setLevel(logging.INFO) # 確保 Flask logger 級別正確
    
    # 更簡潔的方式是直接使用 Flask 的 logger，它在 debug=True 時默認輸出到控制台
    if not app.debug: # 在非 debug 模式下，確保日誌輸出
        stream_handler = logging.StreamHandler()
        stream_handler.setLevel(logging.INFO)
        app.logger.addHandler(stream_handler)
        app.logger.setLevel(logging.INFO)
    else: # Debug 模式下，Flask 已經配置了 logger
        app.logger.setLevel(logging.INFO) # 可以設為 DEBUG 獲取更詳細日誌

    app.logger.info("Flask 應用程式啟動...")
    app.run(host='0.0.0.0', port=5001, debug=True)