# models/cnn1d_model.py

import torch
import torch.nn as nn
import torch.nn.functional as F


class CNN1DModel(nn.Module):
    """
    1D Convolutional model for stock direction classification.

    Input:  (batch, seq_len, n_features)
    Output: (batch, 1) — raw logit (positive = predicts UP, negative = predicts DOWN)

    Uses BatchNorm + Dropout for regularization.
    AdaptiveAvgPool1d collapses the time dimension to a fixed vector.
    """

    def __init__(self, input_size: int, seq_len: int = 20):
        super().__init__()
        self.seq_len    = seq_len
        self.input_size = input_size

        # Project input features to a standard channel dimension
        self.input_proj = nn.Linear(input_size, 64)

        # Conv layers — operate across the time dimension
        self.conv1 = nn.Conv1d(64,  128, kernel_size=3, padding=1)
        self.conv2 = nn.Conv1d(128, 256, kernel_size=3, padding=1)
        self.conv3 = nn.Conv1d(256, 128, kernel_size=3, padding=1)

        self.bn1 = nn.BatchNorm1d(128)
        self.bn2 = nn.BatchNorm1d(256)
        self.bn3 = nn.BatchNorm1d(128)

        self.dropout = nn.Dropout(0.3)
        self.pool    = nn.AdaptiveAvgPool1d(1)   # collapse time → 1

        self.fc1 = nn.Linear(128, 64)
        self.fc2 = nn.Linear(64,  1)

    def forward(self, x):
        # x: (batch, seq_len, features)
        x = F.relu(self.input_proj(x))    # (batch, seq, 64)
        x = x.permute(0, 2, 1)            # (batch, 64, seq)  — Conv1d wants channels first

        x = F.relu(self.bn1(self.conv1(x)))   # (batch, 128, seq)
        x = F.relu(self.bn2(self.conv2(x)))   # (batch, 256, seq)
        x = F.relu(self.bn3(self.conv3(x)))   # (batch, 128, seq)

        x = self.pool(x).squeeze(-1)      # (batch, 128)
        x = self.dropout(x)
        x = F.relu(self.fc1(x))           # (batch, 64)
        x = self.dropout(x)
        return self.fc2(x)                # (batch, 1) — raw logit