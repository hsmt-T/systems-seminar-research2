FROM golang:1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        protobuf-compiler \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest \
    && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

ENV PATH="/go/bin:${PATH}"

WORKDIR /app

EXPOSE 50051

CMD ["bash"]

