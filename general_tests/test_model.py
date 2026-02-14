import torch
from models.hybrid_lstm_gru import HybridLSTMGRU, count_parameters

# Check GPU
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Device: {device}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")

# Test model instantiation
model = HybridLSTMGRU(
    input_size=30,  # Example: will vary based on features
    hidden_size=128,
    num_layers=2,
    dropout=0.2
).to(device)

print(f"\nModel parameters: {count_parameters(model):,}")

# Test forward pass
batch_size = 32
sequence_length = 60
input_size = 30

dummy_input = torch.randn(batch_size, sequence_length, input_size).to(device)
output = model(dummy_input)
print(f"Input shape: {dummy_input.shape}")
print(f"Output shape: {output.shape}")
print("Model test successful!")

# Check memory usage
print(f"\nGPU Memory allocated: {torch.cuda.memory_allocated() / 1e9:.2f} GB")
