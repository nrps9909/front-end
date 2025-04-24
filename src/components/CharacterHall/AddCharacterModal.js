import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

function AddCharacterModal({ show, onHide, onAddCharacter }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validated, setValidated] = useState(false);

  const handleSubmit = (event) => {
    const form = event.currentTarget;
    event.preventDefault();
    event.stopPropagation();

    if (form.checkValidity() === false) {
      setValidated(true);
    } else {
      onAddCharacter({ name, description });
      // 重置表單並關閉
      setName('');
      setDescription('');
      setValidated(false);
      onHide();
    }
  };

  const handleClose = () => {
    // 重置狀態以防下次打開還是驗證失敗的樣子
    setName('');
    setDescription('');
    setValidated(false);
    onHide();
  }

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>新增 AI 角色</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form noValidate validated={validated} onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="characterName">
            <Form.Label>角色名稱 <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="text"
              placeholder="例如：面試官、健談的鄰居"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50} // 限制長度
            />
            <Form.Control.Feedback type="invalid">
              請輸入角色名稱 (最多 50 字)。
            </Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="characterDescription">
            <Form.Label>角色描述 (AI 將依此扮演) <span className="text-danger">*</span></Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="請詳細描述角色的性格、背景、語氣和行為方式，例如：一位嚴謹、注重細節的 HR 面試官，語氣專業，會針對履歷提問，並追問細節。"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={500} // 限制長度
            />
             <Form.Text className="text-muted">
               描述越詳細，AI 扮演得越像。 (最多 500 字)
             </Form.Text>
            <Form.Control.Feedback type="invalid">
              請輸入角色描述。
            </Form.Control.Feedback>
          </Form.Group>
          <div className="d-flex justify-content-end">
             <Button variant="secondary" onClick={handleClose} className="me-2">
               取消
             </Button>
             <Button variant="primary" type="submit">
               儲存角色
             </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}

export default AddCharacterModal;