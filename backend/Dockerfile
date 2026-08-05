FROM golang:1.26.5-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN GOPROXY=https://goproxy.cn,direct go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o server ./cmd/server

FROM alpine:3.24.1
RUN apk add --no-cache ca-certificates postgresql-client
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["./server"]
