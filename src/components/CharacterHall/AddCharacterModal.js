// src/components/CharacterHall/AddCharacterModal.js
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Image } from 'react-bootstrap';

function AddCharacterModal({
  show,
  onHide,
  onAddCharacter,
  onEditCharacter,
  characterToEdit,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState(null); // 用於圖片預覽的 Data URL
  const [imageDataUrl, setImageDataUrl] = useState(null); // 實際儲存的圖片 Data URL
  const [validated, setValidated] = useState(false);
  const fileInputRef = useRef(null); // 用於重置檔案輸入框

  const isEditMode = !!characterToEdit;

  useEffect(() => {
    if (isEditMode && characterToEdit) {
      setName(characterToEdit.name);
      setDescription(characterToEdit.description);
      // 如果 characterToEdit.imageUrl 存在且是 Data URL，則用於預覽和初始值
      if (characterToEdit.imageUrl && characterToEdit.imageUrl.startsWith('data:image')) {
        setImageDataUrl(characterToEdit.imageUrl);
        setImagePreview(characterToEdit.imageUrl);
      } else {
        // 如果是外部 URL (舊版) 或 null，則清除預覽
        setImageDataUrl(null); 
        setImagePreview(null);
      }
    } else {
      // 新增模式，清空所有欄位
      setName('');
      setDescription('');
      setImageDataUrl(null);
      setImagePreview(null);
    }
    setValidated(false); // 重置驗證狀態
    if (fileInputRef.current) { // 重置檔案輸入框的值
        fileInputRef.current.value = "";
    }
  }, [characterToEdit, isEditMode, show]); // 依賴項：當編輯的角色或顯示狀態改變時

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 限制檔案大小 (例如 2MB)
        alert("圖片檔案過大，請選擇 2MB 以下的圖片。");
        event.target.value = ""; // 清空選擇
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result); // 設定預覽圖片
        setImageDataUrl(reader.result); // 儲存 Data URL
      };
      reader.readAsDataURL(file); // 讀取檔案為 Data URL
    } else {
      // 如果沒有選擇檔案（例如取消選擇），清除預覽和 Data URL
      setImagePreview(null);
      setImageDataUrl(null);
    }
  };

  const handleSubmit = (event) => {
    const form = event.currentTarget;
    event.preventDefault();
    event.stopPropagation();

    if (form.checkValidity() === false) {
      setValidated(true);
    } else {
      const characterData = { name, description, imageUrl: imageDataUrl }; // 使用 imageDataUrl
      if (isEditMode) {
        onEditCharacter({ ...characterToEdit, ...characterData });
      } else {
        onAddCharacter(characterData);
      }
      handleClose(); // 提交成功後關閉彈窗
    }
  };

  const handleClose = () => {
    // 如果不是編輯模式，則在關閉時清空表單（下次打開為新增時是乾淨的）
    if (!isEditMode) {
        setName('');
        setDescription('');
    }
    // 總是清除圖片相關狀態，除非你想在取消編輯時保留已選擇但未保存的圖片
    setImagePreview(null);
    setImageDataUrl(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; // 重置檔案輸入框
    }
    setValidated(false);
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{isEditMode ? '編輯 AI 角色' : '新增 AI 角色'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form noValidate validated={validated} onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="characterNameModal">
            <Form.Label>角色名稱 <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="text"
              placeholder="例如：面試官、健談的鄰居"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
            />
            <Form.Control.Feedback type="invalid">
              請輸入角色名稱 (最多 50 字)。
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="characterDescriptionModal">
            <Form.Label>角色描述 (AI 將依此扮演) <span className="text-danger">*</span></Form.Label>
            <Form.Control
              as="textarea"
              rows={8} 
              placeholder="請詳細描述角色的性格、背景、語氣和行為方式..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={2000} 
            />
            <Form.Text className="text-muted">
              描述越詳細，AI 扮演得越像。 (最多 2000 字)
            </Form.Text>
            <Form.Control.Feedback type="invalid">
              請輸入角色描述。
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group controlId="characterImageFileModal" className="mb-3">
            <Form.Label>角色圖片 (選填，建議方形，2MB以下)</Form.Label>
            <Form.Control 
              type="file" 
              accept="image/png, image/jpeg, image/gif, image/webp" // 限制可接受的圖片類型
              onChange={handleImageChange}
              ref={fileInputRef} 
            />
            {imagePreview && ( // 如果有預覽圖片，則顯示
              <div className="mt-2 text-center">
                <Image src={imagePreview} alt="圖片預覽" thumbnail style={{ maxHeight: '150px', maxWidth: '150px' }} />
                <Button variant="link" size="sm" onClick={() => {
                    setImagePreview(null); 
                    setImageDataUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = ""; // 清空檔案輸入
                }}>移除圖片</Button>
              </div>
            )}
            {/* 在編輯模式下，如果角色已有圖片且用戶還未選擇新圖片，顯示目前圖片 */}
            {isEditMode && characterToEdit && characterToEdit.imageUrl && !imagePreview && (
                 <div className="mt-2 text-center">
                    <p className="small text-muted mb-1">目前圖片:</p>
                    <Image src={characterToEdit.imageUrl} alt="目前圖片" thumbnail style={{ maxHeight: '100px', maxWidth: '100px' }} 
                      onError={(e) => { e.target.style.display = 'none';}} // 如果圖片載入失敗則隱藏
                    />
                 </div>
            )}
          </Form.Group>

          <div className="d-flex justify-content-end">
            <Button variant="secondary" onClick={handleClose} className="me-2">
              取消
            </Button>
            <Button variant="primary" type="submit">
              {isEditMode ? '儲存變更' : '儲存角色'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}

export default AddCharacterModal;