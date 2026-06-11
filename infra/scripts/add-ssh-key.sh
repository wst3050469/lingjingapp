#!/bin/bash
KEY="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDWLBmd1Xzrsr5iTKoYPFrHFPpZEYO71IBhFqFDJwMtBCIrrk3J0bFBTrnif3a/DfpKTYjyeJqS2bTwwYCAfv9cFZrqk7k+iNjZSg057w3XUy+mno6SWz0ScYwu/leYhKkfyNK3+JP4+HZe8nmkZ2l92fNvnZsBFwCd/ehC/u8JQH6BjyPauxGQrftb3zhMe+6SOgGt0Mqzbbiyxuj8GBem8P9FAdpYGk9glmu1DiaH9qBChrpkNGODXwF4xe62D4oOqU15/3Hxdy2uwxN0DjQLmgsefFA+qXg83bhT6Lc3cKxdP4J/ZCS3djcT926ZSO6eDpsRanDMsgIi3HNMpoOzHr6sXE5kHnM2hJGYYIqlkGjU6VwI/DOrHMgf9Vyp+pEz9rjz1F4RZusaWSNCAgHyzKTSzqCUoWWhHnFjFIU77odtL4REtyjX7Ifa7Ew59vu9HW0LIS2gZpQfC/KsVCucxWBt4joiAx9LyICPFJSU/rvUKyGJWR0KVsO8Kiiy7YIrvSrEHeO1M1DGV5u6i2S0M3R887EP4NfJDpyHBRwPaQ4gw8Wt2nNNyGDMEK2dv5ahnxb1otgPBnXW1+fTjemNmOma+tbbe/nnarwvEqbQGgpgpkX1xNPwO8b5HreEpWqj/O7rmkibCYnp98rPDNmIhDFnSUY1M9nVyW+lSe4cMw== liuhui@liuhui-AI-Station-395-Max"

if grep -q "liuhui@liuhui" /root/.ssh/authorized_keys 2>/dev/null; then
    echo "Key already exists"
else
    echo "$KEY" >> /root/.ssh/authorized_keys
    echo "Key added"
fi
