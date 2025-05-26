from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import re
import traceback
import logging
from datetime import datetime, timezone

app = Flask(__name__)
CORS(app)

class AppConfig:
    OLLAMA_BASE_API_URL = "http://localhost:11434"

    LINE_STYLE_INSTRUCTION_TAIWAN_UNI = """### **[輸出風格：台灣大學生 LINE/IG 私訊風格 - 絕對規則] (MUST FOLLOW RULES FOR YOUR REPLY):**
*   **核心要求 (Core Requirement)**: 你的回覆必須 100% 模仿台灣大學生用 LINE 或 IG 私訊聊天。輸出**應簡潔明瞭**，**保持語義連貫性，並自然地承接上下文。**
*   **訊息結構**: 每個獨立的語句或概念應盡量簡短，並透過換行符 `\\n` 分隔。不要在單行中塞入過多資訊。
*   **語氣詞必備**: 使用台灣大學生常用語氣詞如「欸」、「啊」、「啦」、「喔」、「耶」、「ㄟ」、「嗯」等。使用口語化表達，避免書面語。
*   **應極力避免 (STRONGLY AVOID):** Emoji, 引號 '"' ''' 「」 『』, 頓號 '、', 分號 ';' 或 '；', 冒號 ':' 或 '：', 括號 '()' '（）' '[]', 項目符號。
*   **唯一允許的標點 (ONLY ALLOWED PUNCTUATION):** 空格 ' ', 換行符 '\\n', 問號 '？' (少量), 驚嘆號 '！' (少量), 逗號 ',' (少量), 句號 '.' 或 '。' (少量，通常用於結尾或短句間)。
*   **絕對禁止 (ABSOLUTELY FORBIDDEN):** **絕對不要使用任何如 "你可以這樣說：" 或 "我建議你回：" 等前綴。直接輸出訊息本身。** 生成過長的單行訊息，或看起來完全脫離上下文的回覆。
*   **訊息長度 (Message Length)**: 總回覆簡短。通常 1 到 4 個 `\\n` (2 到 5 則短訊息)。每則獨立的短訊息 (換行符之間的部分) 應簡短，例如 5 到 25 個漢字為佳 (略微放寬上限，允許語義更完整)。
*   **目標導向**: 始終記住使用者的聊天目標，並在回應中巧妙地朝著該目標引導對話，但不要太明顯或直接提及目標本身。
*   **輸出範例 (Your reply should look like these examples):**
    *   (使用者說：你在幹嘛？) 你回覆：\n沒幹嘛啊\n耍廢中\n你勒
    *   (使用者說：週末要不要出去玩？) 你回覆：\n好啊\n想去哪\n我都可以
    *   (使用者說：上次你說的那部電影好好看喔) 你回覆：\n真的齁\n我就說很讚啊\n那你還有想看什麼嗎
"""
    # 此處保留上次的修改，即允許逗號和句號通過後處理
    POST_PROCESS_PUNCTUATION_TO_REMOVE_FOR_LINE_STYLE = "、；：「」『』（）《》\"'();:"

    CHAT_MODEL_CONFIG = {
        "name": "my-custom-llama3:latest",
        "ollama_options": {
            "temperature": 0.4, 
            "top_p": 0.8,       
            "repeat_penalty": 1.2, 
            "num_predict": 150, # <--- 增加 num_predict，給模型更多空間
            "stop": ["<|eot_id|>", "<|end_of_text|>", "user:", "assistant:", "User:", "Assistant:", "\n\n\n", "Human:", "System:"]
        }
    }
    USER_FEEDBACK_MODEL_CONFIG = {
        "name": "my-custom-llama3:latest",
        "base_system_prompt_template": """你是一位專業的社交技能教練與評估員。
AI 聊天夥伴的角色是：「{character_name}」(描述：「{character_description}」)。
使用者為本次對話設定的目標是：「{goal}」。
你的任務是僅針對 **使用者 (User)** 的發言內容，提供完整的評估報告。""", 

        "user_feedback_instruction_template": """現在，請嚴格依照以下格式提供對 User 的評估 (繁體中文)，不要有任何其他文字。
**不要遺漏任何區塊或評分項。所有評分項和理由都必須提供。**
**重要：所有社交技能評分項都必須提供一個0-100之間、且為整數的數字分數。即使沒有明確目標，目標達成技巧也必須給出一個分數，例如50分代表中等表現，並說明理由。**

1. 使用者整體表現總結: (簡潔摘要，50-100字)
2. 使用者社交技能評分 (0-100分):
    * 表達清晰度 (clarity): (請填寫0-100之間的數字分數) - 理由：[請填寫具體理由，20-50字]
    * 同理心展現 (empathy): (請填寫0-100之間的數字分數) - 理由：[請填寫具體理由，20-50字]
    * 自信程度 (confidence): (請填寫0-100之間的數字分數) - 理由：[請填寫具體理由，20-50字]
    * 言談適當性 (appropriateness): (請填寫0-100之間的數字分數) - 理由：[請填寫具體理由，20-50字]
    * 目標達成技巧 (goalAchievement): (請填寫0-100之間的數字分數) - 理由：[請填寫具體理由，20-50字，若無明確目標，請評估對話推進或互動有效性，並給予分數]
3. 使用者本次對話的優點 (條列式，1-3點，每點15-30字):
    - [優點 1]
    - [優點 2，若無則填「無明顯其他優點」]
4. 給使用者的具體改進建議 (條列式，1-3點，每點15-30字，提供可操作建議):
    - [改進建議 1]
    - [改進建議 2，若無則填「無明顯其他改進空間」]""",
        "ollama_options": { 
            "temperature": 0.1, 
            "top_p": 0.4,
            "num_predict": 1500 
        }
    }
    POST_PROCESS_PREFIX_PATTERN = re.compile(
        r'^\s*(?:好的[,，]?這是我(?:的|建議的)回覆：|你可以(?:這麼|這樣)說：|我建議你回覆：|(?:Okay|Ok|Alright|Sure)[,.]?\s*(?:here(?: is|\'s)\s*(?:a|my|the)?\s*(?:suggestion|reply)|I suggest|you could say)[:：]?|話翼|AI|Assistant|模型|回答|建議|助手|WingChat)\s*[:：]?\s*',
        re.IGNORECASE | re.DOTALL
    )
    POST_PROCESS_PUNCTUATION_TO_REMOVE_FOR_LINE_STYLE = "、；：「」『』（）《》\"'();:"

cfg = AppConfig()
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', force=True)
logger = logging.getLogger(__name__)
if not app.debug: logger.setLevel(logging.INFO)
else: logger.setLevel(logging.DEBUG)

def call_ollama_api(endpoint_path, payload, model_name_for_log, timeout=(25, 120)):
    ollama_url = f"{cfg.OLLAMA_BASE_API_URL}{endpoint_path}"
    try:
        logger.info(f"Sending request to Ollama ({ollama_url}), Model: {model_name_for_log}")
        logger.debug(f"Ollama Payload: {json.dumps(payload, ensure_ascii=False, indent=2)}")
        response = requests.post(ollama_url, json=payload, timeout=timeout)
        response.raise_for_status()
        response_data = response.json()
        generated_text = ""
        if endpoint_path == "/api/generate": generated_text = response_data.get("response", "").strip()
        elif endpoint_path == "/api/chat": generated_text = response_data.get("message", {}).get("content", "").strip()
        logger.info(f"Ollama raw response (Model {model_name_for_log}): {repr(generated_text)[:500]}...")
        return generated_text, response_data
    except requests.exceptions.Timeout:
        logger.error(f"Timeout error calling Ollama API ({model_name_for_log}) at {ollama_url}")
        raise Exception(f"Ollama API ({model_name_for_log}) 超時")
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error calling Ollama API ({model_name_for_log}) at {ollama_url}: {e}")
        raise Exception(f"Ollama API ({model_name_for_log}) 連接錯誤: {cfg.OLLAMA_BASE_API_URL}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Error during Ollama API request ({model_name_for_log}) to {ollama_url}: {e}")
        error_detail_str = ""
        if e.response is not None:
            try:
                error_detail = e.response.json(); error_detail_str = json.dumps(error_detail)
                model_name_in_payload = payload.get('model', 'N/A')
                if "model not found" in error_detail_str.lower() or \
                   (isinstance(error_detail.get("error"), str) and "model" in error_detail.get("error").lower() and "not found" in error_detail.get("error").lower()):
                    logger.error(f"Ollama error: Model '{model_name_in_payload}' not found.")
                    raise Exception(f"Ollama API 錯誤: 模型 '{model_name_in_payload}' 未找到。")
                logger.error(f"Ollama error details (JSON): {error_detail_str}")
            except json.JSONDecodeError: error_detail_str = e.response.text; logger.error(f"Ollama error details (Non-JSON): {error_detail_str}")
        raise Exception(f"Ollama API ({model_name_for_log}) 請求錯誤: {e} - Details: {error_detail_str}")
    except Exception as e:
        logger.error(f"Unexpected error during Ollama communication (Model {model_name_for_log}): {e}\n{traceback.format_exc()}")
        raise Exception(f"與 Ollama API ({model_name_for_log}) 通訊時發生未知內部錯誤: {e}")

def create_chat_prompt_for_ollama(goal, messages, character_info, mode):
    history_limit = 10 # <--- 將歷史訊息限制增加到 10 條，即 5 輪對話
    relevant_messages = messages[-history_limit:]
    logger.debug(f"Using last {len(relevant_messages)} of {len(messages)} messages for context (limit was {history_limit}).")

    conversation_str = ""
    for msg in relevant_messages:
        role = msg.get("role")
        content = msg.get("content", "").strip()
        if not content: continue
        if role == "user": conversation_str += f"<|start_header_id|>user<|end_header_id|>\n\n{content}<|eot_id|>"
        elif role == "assistant": conversation_str += f"<|start_header_id|>assistant<|end_header_id|>\n\n{content}<|eot_id|>"
    
    system_prompt_str = ""
    if mode == "character_play":
        system_parts = []
        persona_name = "一個聊天夥伴"
        persona_desc_detail = "健談的"
        if character_info:
            persona_name = character_info.get('name', persona_name)
            persona_desc_detail = character_info.get('description', persona_desc_detail)
        
        system_parts.append(f"### 絕對指令：角色扮演 ###\n你現在 **必須** 扮演角色：**{persona_name}**。你不是 AI 語言模型或助手。你的所有思考和回覆都必須從 **{persona_name}** 的角度出發。\n")
        system_parts.append(f"### {persona_name} 的詳細個性與背景設定：\n{persona_desc_detail}\n請徹底理解並融入以上設定。\n")
        
        # <--- 新增這一段，明確指示模型利用上下文
        system_parts.append(f"### 對話連貫性與上下文利用 (CRITICAL): ###\n**你必須嚴格根據之前的所有對話紀錄 (如果你接收到了的話) 來連貫地生成回覆。**\n回覆應展現你對對話流程、之前討論過的話題、以及使用者先前發言的理解。維持對話的邏輯性與一致性，讓互動感覺自然且流暢，就像真人對話一樣。請特別注意之前討論過的特定細節和主題，並在你的回覆中自然地提及或延續這些內容。\n")
        # --- 結束新增 ---

        user_goal_statement = "使用者希望與你進行自然的對話練習。"
        if goal and goal.strip() and goal.lower() != "進行自然的對話練習":
             user_goal_statement = f"使用者目前希望與你達成的社交目標是：「{goal}」。"
        system_parts.append(f"### 對話情境：\n{user_goal_statement}\n")
        system_parts.append(cfg.LINE_STYLE_INSTRUCTION_TAIWAN_UNI)
        system_parts.append(f"### 你的任務：\n作為 **{persona_name}**，嚴格遵守上述所有角色設定、對話連貫性要求和 LINE/IG 私訊風格規則，自然地與使用者互動。直接輸出你作為 **{persona_name}** 的回覆，不要有任何角色名稱外的註解或前綴。")
        system_prompt_str = "\n\n".join(system_parts)

    elif mode == "assistant":
        partner_name = "朋友/同學"
        partner_desc = "未提供描述"
        if character_info and character_info.get('id') != 'generic': 
            partner_name = character_info.get('name', partner_name)
            partner_desc = character_info.get('description', partner_desc)
        partner_persona_desc = f"你的聊天對象是 **{partner_name}**。\n對方的個性簡述：{partner_desc}。"
        
        partner_last_message = "對方剛才說了一些話"
        if messages and messages[-1].get("role") == "user":
             partner_last_message = messages[-1].get("content","").strip()
        
        system_parts = [
            "你是一位 AI 聊天助手，專門為使用者草擬回覆。",
            f"使用者希望達成的溝通目標是：「{goal}」。", 
            partner_persona_desc,
            f"該聊天對象剛剛傳來的訊息是：「{partner_last_message}」。",
            # <--- 新增這一段，明確指示模型利用上下文
            f"### 回覆建議的連貫性與上下文利用 (CRITICAL): ###\n**你必須嚴格根據之前的所有對話紀錄 (如果你接收到了的話) 來連貫地生成回覆建議。**\n回覆應展現使用者對對話流程、之前討論過的話題、以及對方先前發言的理解。維持對話的邏輯性與一致性，讓建議感覺自然且流暢。請特別注意之前討論過的特定細節和主題，並在建議中自然地提及或延續這些內容。\n",
            # --- 結束新增 ---
            "你的任務是提供「代表使用者本人」的回覆建議，而非基於AI角色回應。這個回覆應該是使用者可以直接複製貼上的文本。",  # 修改這一行，強調是代表使用者本人回覆
            cfg.LINE_STYLE_INSTRUCTION_TAIWAN_UNI,
            "請根據對話上下文，幫使用者草擬一個真實自然、符合台灣大學生風格的回覆。直接輸出回覆內容，不要有任何解釋或前綴。這個回覆應該代表使用者的聲音和立場，而不是AI的建議。"  # 修改這一行，強調代表使用者的聲音
        ]
        system_prompt_str = "\n\n".join(system_parts)
        
    final_prompt_content = (
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt_str}<|eot_id|>"
        f"{conversation_str}"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )
    logger.debug(f"Mode: {mode} - Char/Partner: {character_info.get('name') if character_info else 'N/A'} - Goal: {goal} - Prompt: {repr(final_prompt_content)}")
    return final_prompt_content

def post_process_line_style_reply(raw_ai_reply, mode_log="reply"):
    logger.debug(f"Pre-processing {mode_log} (LINE style): {repr(raw_ai_reply)}")
    cleaned_reply = cfg.POST_PROCESS_PREFIX_PATTERN.sub('', raw_ai_reply).strip()
    cleaned_reply = re.sub(r'^```json\s*\{[\s\S]*?\}\s*```', '', cleaned_reply, flags=re.DOTALL | re.MULTILINE).strip()
    cleaned_reply = re.sub(r'^\{[\s\S]*?\}$', '', cleaned_reply, flags=re.DOTALL | re.MULTILINE).strip()

    # 此處保留上次的修改：POST_PROCESS_PUNCTUATION_TO_REMOVE_FOR_LINE_STYLE 不再移除逗號和句號
    temp_reply_chars = [char for char in cleaned_reply if char not in cfg.POST_PROCESS_PUNCTUATION_TO_REMOVE_FOR_LINE_STYLE]
    cleaned_reply = "".join(temp_reply_chars)
    cleaned_reply = cleaned_reply.replace('\\n', '\n').replace('\r\n', '\n').replace('\r', '\n')
    lines = [line.strip() for line in cleaned_reply.split('\n') if line.strip()]
    final_output = "\n".join(lines)
    if not final_output and raw_ai_reply.strip(): 
        logger.warning(f"Post-processing for {mode_log} resulted in empty string for non-empty raw reply. Raw: {repr(raw_ai_reply)}. Returning original stripped reply.")
        return raw_ai_reply.strip() 
    elif not final_output and not raw_ai_reply.strip(): 
        logger.info(f"Post-processing for {mode_log}: Raw reply was empty, returning empty.")
        return "" 
        
    logger.debug(f"Post-processed {mode_log} (LINE style) - FINAL OUTPUT: {repr(final_output)}")
    return final_output

@app.route('/api/chat_py', methods=['POST'])
def chat_py_endpoint():
    try:
        data = request.get_json()
        if not data: logger.warning("/api/chat_py - Request body is not JSON"); return jsonify({"error": "請求主體必須是 JSON"}), 400
        
        character_info = data.get('character')
        goal = data.get('goal', "") 
        js_messages = data.get('messages', [])
        mode = data.get('mode', "character_play")

        if mode == "character_play" and not character_info:
            logger.warning(f"/api/chat_py (mode: {mode}) - Character info is missing.")
            return jsonify({"error": "角色扮演模式需要角色資訊。"}), 400
        if mode == "assistant":
            if not goal.strip():
                logger.warning(f"/api/chat_py (mode: {mode}) - Goal is missing.")
                return jsonify({"error": "聊天助手模式需要設定溝通目標。"}), 400
            if not js_messages or js_messages[-1].get("role") != "user": 
                 logger.warning(f"/api/chat_py (mode: {mode}) - Last message is not from user (partner).")
                 return jsonify({"error": "聊天助手模式需要對方訊息作為最後一條。"}), 400
        
        model_config = cfg.CHAT_MODEL_CONFIG; model_name = model_config["name"]
        full_prompt = create_chat_prompt_for_ollama(goal, js_messages, character_info, mode)
        payload = {"model": model_name, "prompt": full_prompt, "stream": False, "raw": True, "options": model_config["ollama_options"]}
        raw_reply, _ = call_ollama_api("/api/generate", payload, model_name)
        final_reply = post_process_line_style_reply(raw_reply, mode_log=f"{mode} mode output")
        return jsonify({"model": model_name, "created_at": datetime.now(timezone.utc).isoformat(), "message": {"role": "assistant", "content": final_reply}, "done": True}), 200
    except Exception as e:
        mode_for_log = data.get('mode', 'N/A') if isinstance(data, dict) else 'N/A'
        logger.error(f"API /api/chat_py (mode: {mode_for_log}) unhandled error: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e), "done": True, "model": cfg.CHAT_MODEL_CONFIG.get("name")}), 500

def parse_user_feedback_from_llm(raw_feedback_text):
    logger.debug(f"Parsing user performance feedback text (length: {len(raw_feedback_text)}):\n{raw_feedback_text[:1500]}...")
    feedback_data = {
        "summary": "AI 未能提供整體總結。",
        "scores": { "clarity": {"score": None, "justification": "AI 未提供"}, "empathy": {"score": None, "justification": "AI 未提供"},
                    "confidence": {"score": None, "justification": "AI 未提供"}, "appropriateness": {"score": None, "justification": "AI 未提供"},
                    "goalAchievement": {"score": None, "justification": "AI 未提供"} },
        "strengths": ["AI 未提供具體優點"], "improvements": ["AI 未提供具體建議"]
    }
    try:
        # --- START MODIFICATION IN parse_user_feedback_from_llm ---
        # (This section was already modified and validated in previous steps)

        # 1. 總結 - 移除方括號 `[]` 以匹配模型輸出，並調整結束匹配符
        summary_match = re.search(r"1\.?\s*使用者整體表現總結\s*[:：]?\s*(?:\**)?([\s\S]*?)(?=\n*\s*2\.?\s*使用者社交技能評分|\Z)", raw_feedback_text, re.DOTALL | re.IGNORECASE)
        if summary_match and summary_match.group(1).strip():
            feedback_data["summary"] = summary_match.group(1).strip()
        else:
            logger.warning("Could not parse user performance summary.")

        # 2. 評分區塊 - 移除方括號 `[]`，並調整結束匹配符
        score_categories_map = { 
            "clarity": "表達清晰度", "empathy": "同理心展現", "confidence": "自信程度",
            "appropriateness": "言談適當性", "goalAchievement": "目標達成技巧"
        }
        scores_block_match = re.search(r"2\.?\s*使用者社交技能評分(?:\s*\(0-100分?\))?\s*[:：]?\s*([\s\S]*?)(?=\n*\s*3\.?\s*使用者本次對話的優點|\Z)", raw_feedback_text, re.DOTALL | re.IGNORECASE)
        if scores_block_match:
            scores_text = scores_block_match.group(1)
            logger.debug(f"Scores block found:\n{scores_text[:500]}...")
            for key, name_ch_template in score_categories_map.items():
                pattern = r"\*\s*" + re.escape(name_ch_template) + \
                          r"(?:\s*\(" + re.escape(key) + r"\))?" + \
                          r"\s*[:：]?\s*(\d{1,3})\s*分?\s*-\s*理由\s*[:：]?\s*([^\n]+)"
                match = re.search(pattern, scores_text, re.IGNORECASE)
                
                if match:
                    try:
                        score_val_str = match.group(1)
                        justification_str = match.group(2).strip()
                        if score_val_str:
                            score_val = int(score_val_str)
                            feedback_data["scores"][key]["score"] = max(0, min(100, score_val))
                        if justification_str:
                             feedback_data["scores"][key]["justification"] = justification_str
                        logger.info(f"Parsed score for '{key}': {score_val_str}, Justification: {justification_str}")
                    except (ValueError, IndexError) as ve: 
                        logger.warning(f"Error parsing score/justification for '{key}': {ve}. Matched text part: '{match.group(0)[:100]}'. Groups: {match.groups()}")
                else: 
                    # Fallback for "目標達成技巧" or any other score item if it doesn't have a numeric score
                    # This pattern tries to find the justification even if no score is provided.
                    # It also specifically allows for cases where "分數 - 理由" part is missing完全
                    no_score_pattern = r"\*\s*" + re.escape(name_ch_template) + \
                                       r"(?:\s*\(" + re.escape(key) + r"\))?" + \
                                       r"\s*[:：]?\s*(?:(?:\d{1,3})\s*分?\s*-\s*)?理由\s*[:：]?\s*([^\n]+)"
                    no_score_match = re.search(no_score_pattern, scores_text, re.IGNORECASE)
                    if no_score_match:
                        justification_str = no_score_match.group(1).strip()
                        feedback_data["scores"][key]["score"] = None # Set score to None if not numeric
                        feedback_data["scores"][key]["justification"] = justification_str
                        logger.warning(f"Found non-numeric/missing score for '{key}': Justification: {justification_str}. Setting score to None.")
                    else:
                        logger.warning(f"Could not find score item for: '{key}' ({name_ch_template}) in scores block. (Both numeric and non-numeric patterns failed)")
        else: 
            logger.warning("Could not find 使用者社交技能評分 block in raw text.")

        # 3. 優點 - 移除方括號 `[]`，並調整結束匹配符
        strengths_match = re.search(r"3\.?\s*使用者本次對話的優點\s*[:：]?\s*(?:\([^)]+\)\s*)?([\s\S]*?)(?=\n*\s*4\.?\s*給使用者的具體改進建議|\Z)", raw_feedback_text, re.DOTALL | re.IGNORECASE)
        if strengths_match and strengths_match.group(1).strip():
            strengths_content = strengths_match.group(1).strip()
            parsed_strengths = [s.strip() for s in re.findall(r"-\s*([^\r\n]+)", strengths_content) if s.strip()]
            if parsed_strengths: feedback_data["strengths"] = parsed_strengths
            else: logger.warning(f"Found strengths block but no list items: {strengths_content[:100]}")
        else:
            logger.warning("Could not parse user performance strengths.")
        
        # 4. 改進建議 - 移除方括號 `[]`，並調整結束匹配符
        improvements_match = re.search(r"4\.?\s*給使用者的具體改進建議\s*[:：]?\s*(?:\([^)]+\)\s*)?([\s\S]*?)(?:\Z)", raw_feedback_text, re.DOTALL | re.IGNORECASE)
        if improvements_match and improvements_match.group(1).strip():
            improvements_content = improvements_match.group(1).strip()
            parsed_improvements = [s.strip() for s in re.findall(r"-\s*([^\r\n]+)", improvements_content) if s.strip()]
            if parsed_improvements: feedback_data["improvements"] = parsed_improvements
            else: logger.warning(f"Found improvements block but no list items: {improvements_content[:100]}")

        else:
            logger.warning("Could not parse user performance improvements.")

        # --- END MODIFICATION IN parse_user_feedback_from_llm ---

    except Exception as e: 
        logger.error(f"Critical error during parsing user feedback: {e}\n{traceback.format_exc()}")
    
    logger.info(f"Final parsed user feedback data: {json.dumps(feedback_data, ensure_ascii=False, indent=2)}")
    return feedback_data

@app.route('/api/feedback', methods=['POST'])
def feedback_endpoint():
    try:
        data = request.get_json()
        if not data: logger.warning("/api/feedback - Request body is not JSON"); return jsonify({"error": "請求主體必須是 JSON"}), 400
        
        goal = data.get('goal', "一般對話練習") 
        js_messages = data.get('messages', [])
        character = data.get('character', {})

        if not js_messages: 
            logger.warning("/api/feedback - Messages list is empty."); return jsonify({"error": "缺少 messages 欄位"}), 400
        if not character.get('name') or not character.get('description'):
            logger.warning("/api/feedback - Character name or description is missing."); return jsonify({"error": "缺少 character.name 或 character.description 欄位"}), 400

        model_config = cfg.USER_FEEDBACK_MODEL_CONFIG; model_name = model_config["name"]
        
        feedback_history_limit = 10 
        relevant_feedback_messages = js_messages[-feedback_history_limit:]
        
        conversation_history_str = ""
        for msg in relevant_feedback_messages:
            role = msg.get("role")
            content = msg.get("content", "").strip()
            if not content: continue 
            conversation_history_str += f"{role.capitalize()}: {content}\n" 
        
        base_system_prompt = model_config["base_system_prompt_template"].format(
            goal=goal, 
            character_name=character.get('name'), 
            character_description=character.get('description')
        )

        user_turn_content = f"""對話記錄開始：
{conversation_history_str}
對話記錄結束。

{model_config["user_feedback_instruction_template"]}""" 

        full_feedback_prompt = (
            f"<|begin_of_text|>"
            f"<|start_header_id|>system<|end_header_id|>\n\n{base_system_prompt}<|eot_id|>"
            f"<|start_header_id|>user<|end_header_id|>\n\n{user_turn_content}<|eot_id|>"
            f"<|start_header_id|>assistant<|end_header_id|>\n\n"
        )
        
        logger.debug(f"User Feedback full prompt (first 500 chars): {repr(full_feedback_prompt)[:500]}...")
        logger.debug(f"Number of messages included in conversation_history_str for feedback: {len(relevant_feedback_messages)}")

        payload = {"model": model_name, "prompt": full_feedback_prompt, "stream": False, "raw": True, "options": model_config["ollama_options"]}
        raw_llm_feedback, _ = call_ollama_api("/api/generate", payload, model_name)
        
        if not raw_llm_feedback or not raw_llm_feedback.strip():
            logger.warning(f"LLM returned empty or whitespace-only feedback for model {model_name}.")
            parsed_user_feedback = {
                "summary": "AI 未能成功產生回饋內容，請稍後再試或調整提示。",
                "scores": {k: {"score": None, "justification": "AI 未回傳有效評分"} for k in {"clarity", "empathy", "confidence", "appropriateness", "goalAchievement"}}, 
                "strengths": ["AI 未提供"], "improvements": ["AI 未提供"]
            }
        else:
            parsed_user_feedback = parse_user_feedback_from_llm(raw_llm_feedback)

        return jsonify({"model": model_name, "created_at": datetime.now(timezone.utc).isoformat(), "userEvaluation": parsed_user_feedback, "raw_feedback": raw_llm_feedback, "done": True}), 200
    except Exception as e:
        logger.error(f"API /api/feedback (user eval) unhandled error: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e), "done": True, "model": cfg.USER_FEEDBACK_MODEL_CONFIG.get("name")}), 500

if __name__ == '__main__':
    logger.info("Starting Flask application (WingChat Backend)...")
    app.run(host='0.0.0.0', port=5001, debug=True)